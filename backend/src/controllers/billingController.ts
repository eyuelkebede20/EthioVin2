import type { Request, Response } from "express";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { apiKey, creditPurchase, promoCode, promoRedemption, credit_ledger } from "../db/schema.ts";
import { AppError } from "../middleware/errorHandler.ts";
import * as creditBridge from "../services/creditBridge.ts";
import { chapaConfigured, isTestMode, billingMockMode, initializePayment, verifyPayment, verifyWebhookSignature } from "../services/chapaService.ts";
import { redeemPromo as redeemPromoService, PromoError } from "../services/promoService.ts";
import { checkoutSchema, promoRedeemSchema } from "../utils/validation.ts";
import { PAID_RATE_LIMIT_PER_MIN } from "../lib/pricing.ts";
import { getPricingConfig, getPackById } from "../services/pricingService.ts";
import { nano } from "../utils/id.ts";

// GET /billing/packs — the single pricing source (never hardcoded in web/). Reads the
// runtime-editable pricing (app_settings), falling back to code defaults.
export const listPacks = async (_req: Request, res: Response) => {
  const { packs } = await getPricingConfig();
  return res.json({
    currency: "ETB",
    // billing_enabled: false when no Chapa key is set (checkout returns 503). test_mode:
    // true when a CHASECK_TEST- key is configured, so the portal can show a sandbox badge.
    billing_enabled: chapaConfigured(),
    test_mode: isTestMode(),
    mock_mode: billingMockMode(),
    packs: packs.map((p) => ({ pack_id: p.packId, credits: p.credits, price_etb: p.priceEtb, note: p.note })),
  });
};

// POST /billing/checkout { packId } — create a pending purchase + Chapa checkout.
export const checkout = async (req: Request, res: Response) => {
  if (!chapaConfigured()) throw new AppError(503, "Billing is not configured.");
  const ownerId = req.user!.id;
  const { packId } = checkoutSchema.parse(req.body);
  const pack = await getPackById(packId);
  if (!pack) throw new AppError(400, "Unknown credit pack.");

  const txRef = "evnp_" + nano(24);
  await db.insert(creditPurchase).values({
    ownerId,
    packId: pack.packId,
    credits: pack.credits,
    amountEtb: String(pack.priceEtb),
    chapaTxRef: txRef,
    status: "pending",
  });

  // return_url is a BROWSER redirect to the web portal's billing tab (a web/ route,
  // NOT the API). Use PUBLIC_WEB_URL (the portal origin); fall back to the first
  // FRONTEND_URL origin, then the API base as a last resort. The billing tab reads
  // ?tx= and polls GET /billing/purchase/:txRef, which re-verifies + settles — so the
  // whole flow works even without a public webhook (essential for local test mode).
  const webBase = (
    process.env.PUBLIC_WEB_URL ??
    (process.env.FRONTEND_URL ?? "").split(",")[0] ??
    process.env.PUBLIC_API_BASE_URL ??
    ""
  ).replace(/\/+$/, "");
  const returnUrl = `${webBase}/dashboard/api?tab=billing&tx=${encodeURIComponent(txRef)}`;
  const { checkoutUrl } = await initializePayment({
    amount: pack.priceEtb,
    txRef,
    returnUrl,
    email: req.user!.email,
    title: "EthioVin",
    description: `${pack.credits} API credits (${pack.packId})`,
  });

  return res.json({ checkout_url: checkoutUrl, tx_ref: txRef, test_mode: isTestMode(), mock_mode: billingMockMode() });
};

/**
 * Settle a purchase: authoritative Chapa verify, then (pending -> paid) + credit grant
 * + tier bump in ONE transaction. Idempotent — `paid` is terminal, re-delivery is a
 * no-op, and the unique chapa_tx_ref is the replay guard. Shared by the webhook and the
 * return-page poll fallback.
 */
export async function settlePurchase(txRef: string): Promise<typeof creditPurchase.$inferSelect | null> {
  const [purchase] = await db.select().from(creditPurchase).where(eq(creditPurchase.chapaTxRef, txRef)).limit(1);
  if (!purchase) return null;
  if (purchase.status === "paid") return purchase; // terminal — no-op

  const verified = await verifyPayment(txRef);
  if (!verified.paid) return purchase; // still pending/failed — don't credit

  await db.transaction(async (tx) => {
    // Re-read under a row lock; the status guard makes double-credit impossible.
    const [locked] = await tx.select().from(creditPurchase).where(eq(creditPurchase.chapaTxRef, txRef)).for("update").limit(1);
    if (!locked || locked.status === "paid") return;

    await tx.update(creditPurchase).set({ status: "paid", paidAt: new Date() }).where(eq(creditPurchase.id, locked.id));
    await creditBridge.grant({ ownerId: locked.ownerId, amount: locked.credits, source: "purchase", ref: "purchase:" + txRef }, tx);

    // First purchase moves the account's free-tier keys to the paid RPM (never lowers a higher override).
    await tx
      .update(apiKey)
      .set({ rateLimitPerMin: PAID_RATE_LIMIT_PER_MIN })
      .where(and(eq(apiKey.ownerId, locked.ownerId), eq(apiKey.status, "active"), lt(apiKey.rateLimitPerMin, PAID_RATE_LIMIT_PER_MIN)));
  });

  const [updated] = await db.select().from(creditPurchase).where(eq(creditPurchase.chapaTxRef, txRef)).limit(1);
  return updated ?? purchase;
}

// GET /billing/purchase/:txRef — poll status; re-verify as a fallback if still pending.
export const getPurchase = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const txRef = String(req.params.txRef ?? "");
  let [purchase] = await db
    .select()
    .from(creditPurchase)
    .where(and(eq(creditPurchase.chapaTxRef, txRef), eq(creditPurchase.ownerId, ownerId)))
    .limit(1);
  if (!purchase) throw new AppError(404, "Purchase not found.");

  if (purchase.status === "pending" && chapaConfigured()) {
    const settled = await settlePurchase(txRef);
    if (settled) purchase = settled;
  }

  return res.json({
    tx_ref: purchase.chapaTxRef,
    pack_id: purchase.packId,
    credits: purchase.credits,
    amount_etb: purchase.amountEtb,
    status: purchase.status,
    paid_at: purchase.paidAt,
    balance: await creditBridge.balance(ownerId),
  });
};

// POST /billing/promo { code } — redeem a promo code.
export const redeemPromo = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const { code } = promoRedeemSchema.parse(req.body);
  try {
    const result = await redeemPromoService(ownerId, code);
    return res.json(result);
  } catch (err) {
    if (err instanceof PromoError) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    throw err;
  }
};

// GET /billing/history — purchases + promo redemptions + grants for the account.
export const billingHistory = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;

  const purchases = await db
    .select()
    .from(creditPurchase)
    .where(eq(creditPurchase.ownerId, ownerId))
    .orderBy(desc(creditPurchase.createdAt))
    .limit(100);

  const redemptions = await db
    .select({ code: promoCode.code, credited: promoRedemption.credited, createdAt: promoRedemption.createdAt })
    .from(promoRedemption)
    .innerJoin(promoCode, eq(promoRedemption.promoCodeId, promoCode.id))
    .where(eq(promoRedemption.ownerId, ownerId))
    .orderBy(desc(promoRedemption.createdAt))
    .limit(100);

  // Signup + admin grants come from the ledger (they have no other table).
  const grants = await db
    .select({ delta: credit_ledger.delta, eventId: credit_ledger.eventId, createdAt: credit_ledger.createdAt })
    .from(credit_ledger)
    .where(and(eq(credit_ledger.userId, ownerId), sql`(${credit_ledger.eventId} like 'signup:%' or ${credit_ledger.eventId} like 'admin:%')`))
    .orderBy(desc(credit_ledger.createdAt))
    .limit(100);

  return res.json({
    balance: await creditBridge.balance(ownerId),
    purchases: purchases.map((p) => ({ tx_ref: p.chapaTxRef, pack_id: p.packId, credits: p.credits, amount_etb: p.amountEtb, status: p.status, created_at: p.createdAt, paid_at: p.paidAt })),
    promo_redemptions: redemptions.map((r) => ({ code: r.code, credited: r.credited, created_at: r.createdAt })),
    grants: grants.map((g) => ({ credits: Number(g.delta), kind: g.eventId?.startsWith("admin:") ? "admin_grant" : "signup_grant", created_at: g.createdAt })),
  });
};

// POST /api/v1/dev/billing/webhook — Chapa callback. Registered in index.ts BEFORE
// express.json() with express.raw so the HMAC can be verified over the raw body.
export const chapaWebhook = async (req: Request, res: Response) => {
  if (!chapaConfigured()) return res.status(503).json({ error: "Billing not configured" });

  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body ?? ""));
  const sigHeader = req.headers["chapa-signature"] ?? req.headers["x-chapa-signature"];
  const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
  if (!verifyWebhookSignature(raw, typeof signature === "string" ? signature : undefined)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  let payload: { tx_ref?: string; trx_ref?: string; data?: { tx_ref?: string } };
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Bad payload" });
  }
  const txRef = payload.tx_ref ?? payload.trx_ref ?? payload.data?.tx_ref;
  if (!txRef) return res.status(400).json({ error: "Missing tx_ref" });

  try {
    await settlePurchase(txRef);
  } catch (err) {
    console.error(`[chapa] webhook settle failed for ${txRef}:`, err);
    // 200 anyway — the poll fallback + a later re-delivery will reconcile; a 500
    // would make Chapa hammer the endpoint.
  }
  return res.status(200).json({ received: true });
};
