import type { Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { insurance_claims, police_reports, vehicle_events, odometer_readings, data_sharing_agreements } from "../db/schema.ts";
import { parseVin } from "../utils/vin.ts";
import { ingestVehicleEvent } from "../services/eventService.ts";
import { recordCredit } from "../services/creditService.ts";
import { computeHealthGrade } from "../services/healthGrade.ts";
import { resolveVehicle } from "./decodeController.ts";
import { writeAudit } from "../middleware/audit.ts";
import { AppError } from "../middleware/errorHandler.ts";
import { insuranceClaimIntakeSchema, policeReportIntakeSchema } from "../utils/validation.ts";

function ctx(req: Request): { userId: string; orgId: string } {
  const userId = req.user?.id;
  const orgId = req.org?.id;
  if (!userId) throw new AppError(401, "Unauthorized");
  if (!orgId) throw new AppError(403, "Not a member of an insurer organization");
  return { userId, orgId };
}

// The lawful basis for the exchange (plan §3b): an org must hold an ACTIVE
// data-sharing agreement before it can submit signals or pull vehicle views.
async function assertAgreement(orgId: string): Promise<void> {
  const [a] = await db
    .select({ id: data_sharing_agreements.id })
    .from(data_sharing_agreements)
    .where(and(eq(data_sharing_agreements.orgId, orgId), eq(data_sharing_agreements.status, "active")))
    .limit(1);
  if (!a) throw new AppError(403, "No active data-sharing agreement for this organization");
}

// ---------------------------------------------------------------------------
// POST /claims — INTAKE MINIMIZATION GATE. The Zod schema already strips any
// extra fields the insurer sends (claim narrative, claimant PII, amounts,
// documents); we persist ONLY the health signal. Also emits a vehicle_event so
// the insurer earns credit and the signal lands in the shared history.
// ---------------------------------------------------------------------------
export const postClaim = async (req: Request, res: Response) => {
  const { userId, orgId } = ctx(req);
  await assertAgreement(orgId);
  const body = insuranceClaimIntakeSchema.parse(req.body);
  const { keyVin } = parseVin(body.vin);

  const claim = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(insurance_claims)
      .values({ orgId, vin: keyVin, incidentType: body.incidentType, severityBand: body.severityBand, incidentDate: body.incidentDate ?? null, payoutBand: body.payoutBand ?? null })
      .returning({ id: insurance_claims.id });
    if (!row) throw new AppError(500, "Failed to record claim");

    await ingestVehicleEvent(tx, {
      vin: keyVin,
      eventType: "insurance_claim",
      payload: { incidentType: body.incidentType, severityBand: body.severityBand },
      occurredAt: body.incidentDate ?? undefined,
      recordedBy: userId,
      orgId,
      sourceType: "insurer",
      idempotencyKey: `claim:${row.id}`,
    });
    return row;
  });

  await writeAudit(req, { action: "insurance.claim.intake", resourceType: "vehicle", resourceId: keyVin, metadata: { claimId: claim.id, severityBand: body.severityBand } });
  return res.status(201).json({ ok: true, claimId: claim.id });
};

// ---------------------------------------------------------------------------
// POST /police-reports — same minimized intake → police_reports + event + audit.
// ---------------------------------------------------------------------------
export const postPoliceReport = async (req: Request, res: Response) => {
  const { userId, orgId } = ctx(req);
  await assertAgreement(orgId);
  const body = policeReportIntakeSchema.parse(req.body);
  const { keyVin } = parseVin(body.vin);

  const report = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(police_reports)
      .values({ vin: keyVin, reportRef: body.reportRef ?? null, incidentType: body.incidentType, severityBand: body.severityBand ?? null, incidentDate: body.incidentDate ?? null, sourceOrgId: orgId })
      .returning({ id: police_reports.id });
    if (!row) throw new AppError(500, "Failed to record police report");

    await ingestVehicleEvent(tx, {
      vin: keyVin,
      eventType: "police_report",
      payload: { incidentType: body.incidentType, severityBand: body.severityBand ?? null },
      occurredAt: body.incidentDate ?? undefined,
      recordedBy: userId,
      orgId,
      sourceType: "insurer",
      idempotencyKey: `police:${row.id}`,
    });
    return row;
  });

  await writeAudit(req, { action: "insurance.police.intake", resourceType: "vehicle", resourceId: keyVin, metadata: { reportId: report.id } });
  return res.status(201).json({ ok: true, reportId: report.id });
};

// ---------------------------------------------------------------------------
// GET /vehicles/:vin — EGRESS MINIMIZATION GATE (the insurer view). Returns
// decoded identity + a HEALTH GRADE + an event SUMMARY (counts by type). It does
// NOT return garage customer PII, raw claim rows, or other insurers' data. The
// barter is metered as an "exchange" debit on the credit ledger (best-effort in
// neutral redemption mode — a failure is logged, not silent, and never blocks).
// ---------------------------------------------------------------------------
export const getVehicleView = async (req: Request, res: Response) => {
  const { userId, orgId } = ctx(req);
  await assertAgreement(orgId);

  const { identity } = await resolveVehicle(String(req.params.vin ?? ""));
  const vin = identity.vin;

  const claims = await db.select({ s: insurance_claims.severityBand }).from(insurance_claims).where(eq(insurance_claims.vin, vin));
  const police = await db.select({ s: police_reports.severityBand }).from(police_reports).where(eq(police_reports.vin, vin));
  const [odo] = await db.select({ c: sql<number>`count(*) filter (where ${odometer_readings.flagged})::int` }).from(odometer_readings).where(eq(odometer_readings.vin, vin));
  const [acc] = await db.select({ c: sql<number>`count(*)::int` }).from(vehicle_events).where(and(eq(vehicle_events.vin, vin), eq(vehicle_events.eventType, "accident")));

  const grade = computeHealthGrade({
    claimSeverities: claims.map((c) => Number(c.s)).filter((n) => !Number.isNaN(n)),
    policeSeverities: police.map((p) => Number(p.s)).filter((n) => !Number.isNaN(n)),
    odometerRollbacks: odo?.c ?? 0,
    accidentCount: acc?.c ?? 0,
  });

  // Event SUMMARY only — counts + last date per type. No raw rows, no PII.
  const eventSummary = await db
    .select({ type: vehicle_events.eventType, count: sql<number>`count(*)::int`, lastAt: sql<string | null>`max(${vehicle_events.occurredAt})` })
    .from(vehicle_events)
    .where(eq(vehicle_events.vin, vin))
    .groupBy(vehicle_events.eventType);

  // Meter the barter (exchange debit). Best-effort: log on failure, never block.
  try {
    await db.transaction((tx) => recordCredit(tx, { userId, delta: -1, reason: "exchange" }));
  } catch (err) {
    console.warn(`[insurance] exchange debit skipped for user ${userId}:`, (err as Error).message);
  }

  await writeAudit(req, { action: "insurance.vehicle.view", resourceType: "vehicle", resourceId: vin, metadata: { grade: grade.grade } });

  return res.json({ vehicle: identity, healthGrade: grade, eventSummary });
};
