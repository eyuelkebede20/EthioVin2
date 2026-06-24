import type { Request, Response } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { payments } from "../db/schema.ts";
import { AppError } from "../middleware/errorHandler.ts";
import { paymentInitSchema } from "../utils/validation.ts";
import { createCheckout, verifyWebhookSignature, grantPremium } from "../services/paymentService.ts";

// ---------------------------------------------------------------------------
// POST /payments/init — start a premium purchase. Creates a pending row and
// returns a (stubbed) checkout. requireAuth.
// ---------------------------------------------------------------------------
export const initPayment = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");
  const { amount, provider } = paymentInitSchema.parse(req.body);

  const providerRef = crypto.randomUUID();
  const [row] = await db
    .insert(payments)
    .values({ userId, amount: String(amount), currency: "ETB", provider, providerRef, idempotencyKey: `pay:${providerRef}`, status: "pending" })
    .returning({ id: payments.id });
  if (!row) throw new AppError(500, "Failed to create payment");

  const checkout = createCheckout({ provider, amount, providerRef });
  return res.status(201).json({ paymentId: row.id, providerRef, status: "pending", checkout });
};

// ---------------------------------------------------------------------------
// POST /payments/webhook — PUBLIC (provider callback). IDEMPOTENT: a duplicate
// webhook grants premium EXACTLY ONCE. A per-providerRef advisory lock serializes
// concurrent deliveries; the pending->succeeded status check is the guard.
// ---------------------------------------------------------------------------
export const handleWebhook = async (req: Request, res: Response) => {
  if (!verifyWebhookSignature()) throw new AppError(401, "Invalid webhook signature");
  const providerRef = typeof req.body?.providerRef === "string" ? req.body.providerRef : "";
  if (!providerRef) throw new AppError(400, "Missing providerRef");

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${providerRef})::bigint)`);
    const [pay] = await tx.select().from(payments).where(eq(payments.providerRef, providerRef)).limit(1);
    if (!pay) throw new AppError(404, "Payment not found");

    if (pay.status === "succeeded") return { granted: false, alreadyProcessed: true };
    if (pay.status !== "pending") return { granted: false, alreadyProcessed: false }; // failed/refunded — ignore

    await tx.update(payments).set({ status: "succeeded" }).where(eq(payments.id, pay.id));
    const expiresAt = await grantPremium(tx, pay.userId);
    return { granted: true, alreadyProcessed: false, premiumUntil: expiresAt };
  });

  return res.json({ ok: true, ...result });
};

// ---------------------------------------------------------------------------
// GET /payments/me — the caller's payment history. requireAuth.
// ---------------------------------------------------------------------------
export const listMyPayments = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");
  const rows = await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
  return res.json(rows);
};
