import type { Request, Response } from "express";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { customers, garage_jobs, garage_job_items, odometer_readings, appointments, parts } from "../db/schema.ts";
import { parseVin } from "../utils/vin.ts";
import { ingestVehicleEvent } from "../services/eventService.ts";
import { AppError } from "../middleware/errorHandler.ts";
import { customerSchema, createGarageJobSchema, updateGarageJobSchema, appointmentSchema, updateAppointmentSchema, partSchema, updatePartSchema, JOB_STATUSES, APPOINTMENT_STATUSES } from "../utils/validation.ts";

// requireOrg("garage") guarantees both, but narrow for the type-checker.
function ctx(req: Request): { userId: string; orgId: string } {
  const userId = req.user?.id;
  const orgId = req.org?.id;
  if (!userId) throw new AppError(401, "Unauthorized");
  if (!orgId) throw new AppError(403, "Not a member of a garage organization");
  return { userId, orgId };
}

type JobItemInput = { kind: "labor" | "part"; description: string; qty: number; unitCost: number };

const computeTotal = (items: JobItemInput[]): number => Math.round(items.reduce((s, i) => s + Number(i.qty) * Number(i.unitCost), 0) * 100) / 100;

// ---------------------------------------------------------------------------
// Customers (garage CRM) — scoped to the caller's org.
// ---------------------------------------------------------------------------
export const createCustomer = async (req: Request, res: Response) => {
  const { orgId } = ctx(req);
  const body = customerSchema.parse(req.body);
  const [row] = await db
    .insert(customers)
    .values({ orgId, name: body.name, phone: body.phone ?? null })
    .returning();
  return res.status(201).json(row);
};

export const listCustomers = async (req: Request, res: Response) => {
  const { orgId } = ctx(req);
  const rows = await db.select().from(customers).where(eq(customers.orgId, orgId)).orderBy(desc(customers.createdAt));
  return res.json(rows);
};

// ---------------------------------------------------------------------------
// Jobs (work orders) — create with line items, list, get-with-items, update.
// ---------------------------------------------------------------------------
export const createJob = async (req: Request, res: Response) => {
  const { userId, orgId } = ctx(req);
  const body = createGarageJobSchema.parse(req.body);

  // A VIN, if given, is canonicalized on the server.
  const vin = body.vin ? parseVin(body.vin).keyVin : null;
  const items = (body.items ?? []) as JobItemInput[];
  const total = computeTotal(items);

  // A referenced customer must belong to this org (no cross-org references).
  if (body.customerId) {
    const [c] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, body.customerId), eq(customers.orgId, orgId))).limit(1);
    if (!c) throw new AppError(404, "Customer not found");
  }

  const job = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(garage_jobs)
      .values({
        orgId,
        vin,
        customerId: body.customerId ?? null,
        status: "intake",
        odometerIn: body.odometerIn ?? null,
        totalCost: String(total),
        createdBy: userId,
      })
      .returning();
    if (!created) throw new AppError(500, "Failed to create job");
    if (items.length) {
      await tx.insert(garage_job_items).values(items.map((i) => ({ jobId: created.id, kind: i.kind, description: i.description, qty: String(i.qty), unitCost: String(i.unitCost) })));
    }
    return created;
  });

  const jobItems = await db.select().from(garage_job_items).where(eq(garage_job_items.jobId, job.id));
  return res.status(201).json({ ...job, items: jobItems });
};

export const listJobs = async (req: Request, res: Response) => {
  const { orgId } = ctx(req);
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  if (status && !(JOB_STATUSES as readonly string[]).includes(status)) throw new AppError(400, "Invalid status filter");

  const where = status ? and(eq(garage_jobs.orgId, orgId), eq(garage_jobs.status, status as (typeof JOB_STATUSES)[number])) : eq(garage_jobs.orgId, orgId);
  const rows = await db.select().from(garage_jobs).where(where).orderBy(desc(garage_jobs.openedAt));
  return res.json(rows);
};

export const getJob = async (req: Request, res: Response) => {
  const { orgId } = ctx(req);
  const id = String(req.params.id ?? "");
  const [job] = await db.select().from(garage_jobs).where(and(eq(garage_jobs.id, id), eq(garage_jobs.orgId, orgId))).limit(1);
  if (!job) throw new AppError(404, "Job not found");
  const items = await db.select().from(garage_job_items).where(eq(garage_job_items.jobId, id));
  return res.json({ ...job, items });
};

export const updateJob = async (req: Request, res: Response) => {
  const { userId, orgId } = ctx(req);
  const id = String(req.params.id ?? "");
  const body = updateGarageJobSchema.parse(req.body);

  const result = await db.transaction(async (tx) => {
    // Load the job scoped to this org (the IDOR boundary).
    const [job] = await tx.select().from(garage_jobs).where(and(eq(garage_jobs.id, id), eq(garage_jobs.orgId, orgId))).limit(1);
    if (!job) throw new AppError(404, "Job not found");

    // Replace line items if provided, and recompute the total.
    let total = Number(job.totalCost);
    if (body.items) {
      const items = body.items as JobItemInput[];
      await tx.delete(garage_job_items).where(eq(garage_job_items.jobId, id));
      if (items.length) {
        await tx.insert(garage_job_items).values(items.map((i) => ({ jobId: id, kind: i.kind, description: i.description, qty: String(i.qty), unitCost: String(i.unitCost) })));
      }
      total = computeTotal(items);
    }

    // A job "closes" when it first reaches done/delivered.
    const newStatus = body.status ?? job.status;
    const closing = (newStatus === "done" || newStatus === "delivered") && job.closedAt === null;
    const closedAt = closing ? new Date() : job.closedAt;
    const odometerIn = body.odometerIn ?? job.odometerIn;

    await tx
      .update(garage_jobs)
      .set({ status: newStatus, odometerIn: odometerIn ?? null, totalCost: String(total), closedAt: closedAt ?? null })
      .where(eq(garage_jobs.id, id));

    // On close, feed the shared history: a maintenance/repair event + an odometer
    // reading (flagged on rollback). Idempotent on the job id so re-closing can't
    // double-emit or double-credit.
    if (closing && job.vin) {
      const items = body.items ? (body.items as JobItemInput[]) : await tx.select().from(garage_job_items).where(eq(garage_job_items.jobId, id));
      const hasPart = (items as Array<{ kind: string }>).some((i) => i.kind === "part");
      const occurredAt = closedAt ?? new Date();

      await ingestVehicleEvent(tx, {
        vin: job.vin,
        eventType: hasPart ? "repair" : "maintenance",
        payload: { jobId: id, total, items },
        occurredAt,
        recordedBy: userId,
        orgId,
        sourceType: "garage",
        idempotencyKey: `garage-job:${id}`,
      });

      if (odometerIn != null) {
        const [prev] = await tx.select({ max: sql<number>`max(${odometer_readings.readingKm})::int` }).from(odometer_readings).where(eq(odometer_readings.vin, job.vin));
        const flagged = prev?.max != null && odometerIn < prev.max;
        await tx.insert(odometer_readings).values({ vin: job.vin, readingKm: odometerIn, readAt: occurredAt, source: "garage", recordedBy: userId, orgId, flagged });
      }
    }

    return { closed: closing };
  });

  const [job] = await db.select().from(garage_jobs).where(eq(garage_jobs.id, id)).limit(1);
  const items = await db.select().from(garage_job_items).where(eq(garage_job_items.jobId, id));
  return res.json({ ...job, items, closed: result.closed });
};

// ---------------------------------------------------------------------------
// Appointments (scheduling) — scoped to the caller's org.
// ---------------------------------------------------------------------------
export const createAppointment = async (req: Request, res: Response) => {
  const { orgId } = ctx(req);
  const body = appointmentSchema.parse(req.body);

  if (body.customerId) {
    const [c] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, body.customerId), eq(customers.orgId, orgId))).limit(1);
    if (!c) throw new AppError(404, "Customer not found");
  }
  const vin = body.vin ? parseVin(body.vin).keyVin : null;

  const [row] = await db
    .insert(appointments)
    .values({ orgId, vin, customerId: body.customerId ?? null, scheduledAt: body.scheduledAt, status: "scheduled" })
    .returning();
  return res.status(201).json(row);
};

export const listAppointments = async (req: Request, res: Response) => {
  const { orgId } = ctx(req);
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  if (status && !(APPOINTMENT_STATUSES as readonly string[]).includes(status)) throw new AppError(400, "Invalid status filter");

  const conds = [eq(appointments.orgId, orgId)];
  if (status) conds.push(eq(appointments.status, status));
  const from = typeof req.query.from === "string" ? new Date(req.query.from) : null;
  const to = typeof req.query.to === "string" ? new Date(req.query.to) : null;
  if (from && !Number.isNaN(from.getTime())) conds.push(gte(appointments.scheduledAt, from));
  if (to && !Number.isNaN(to.getTime())) conds.push(lte(appointments.scheduledAt, to));

  const rows = await db.select().from(appointments).where(and(...conds)).orderBy(asc(appointments.scheduledAt));
  return res.json(rows);
};

export const updateAppointment = async (req: Request, res: Response) => {
  const { orgId } = ctx(req);
  const id = String(req.params.id ?? "");
  const body = updateAppointmentSchema.parse(req.body);
  if (body.scheduledAt === undefined && body.status === undefined) throw new AppError(400, "No fields to update");

  const set: { scheduledAt?: Date; status?: string } = {};
  if (body.scheduledAt !== undefined) set.scheduledAt = body.scheduledAt;
  if (body.status !== undefined) set.status = body.status;

  const updated = await db.update(appointments).set(set).where(and(eq(appointments.id, id), eq(appointments.orgId, orgId))).returning();
  if (!updated[0]) throw new AppError(404, "Appointment not found");
  return res.json(updated[0]);
};

// ---------------------------------------------------------------------------
// Parts inventory — scoped to the caller's org.
// ---------------------------------------------------------------------------
export const createPart = async (req: Request, res: Response) => {
  const { orgId } = ctx(req);
  const body = partSchema.parse(req.body);
  const [row] = await db
    .insert(parts)
    .values({ orgId, name: body.name, sku: body.sku ?? null, qtyOnHand: body.qtyOnHand, reorderLevel: body.reorderLevel, unitCost: String(body.unitCost) })
    .returning();
  return res.status(201).json(row);
};

export const listParts = async (req: Request, res: Response) => {
  const { orgId } = ctx(req);
  const lowStock = req.query.lowStock === "true";
  const where = lowStock ? and(eq(parts.orgId, orgId), sql`${parts.qtyOnHand} <= ${parts.reorderLevel}`) : eq(parts.orgId, orgId);
  const rows = await db.select().from(parts).where(where).orderBy(asc(parts.name));
  return res.json(rows);
};

export const updatePart = async (req: Request, res: Response) => {
  const { orgId } = ctx(req);
  const id = String(req.params.id ?? "");
  const body = updatePartSchema.parse(req.body);
  if (body.qtyOnHand !== undefined && body.qtyDelta !== undefined) throw new AppError(400, "Use qtyOnHand or qtyDelta, not both");

  const set: Record<string, unknown> = {};
  if (body.name !== undefined) set.name = body.name;
  if (body.sku !== undefined) set.sku = body.sku;
  if (body.reorderLevel !== undefined) set.reorderLevel = body.reorderLevel;
  if (body.unitCost !== undefined) set.unitCost = String(body.unitCost);
  if (body.qtyOnHand !== undefined) set.qtyOnHand = body.qtyOnHand;
  // Relative stock adjustment, floored at 0, applied atomically in SQL.
  else if (body.qtyDelta !== undefined) set.qtyOnHand = sql`greatest(0, ${parts.qtyOnHand} + ${body.qtyDelta})`;
  if (Object.keys(set).length === 0) throw new AppError(400, "No fields to update");

  const updated = await db.update(parts).set(set).where(and(eq(parts.id, id), eq(parts.orgId, orgId))).returning();
  if (!updated[0]) throw new AppError(404, "Part not found");
  return res.json(updated[0]);
};
