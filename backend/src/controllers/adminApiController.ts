import type { Request, Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { apiKey, credit_ledger, promoCode, user } from "../db/schema.ts";
import { AppError } from "../middleware/errorHandler.ts";
import { writeAudit } from "../middleware/audit.ts";
import * as creditBridge from "../services/creditBridge.ts";
import { generatePromoCode } from "../services/promoService.ts";
import { getPricingConfig, setPricingConfig } from "../services/pricingService.ts";
import { createPromoSchema, adminGrantSchema, updateKeyLimitSchema, updatePricingSchema } from "../utils/validation.ts";
import { nano } from "../utils/id.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/v1/admin/promo — create a promo code (generated if `code` omitted).
export const createPromo = async (req: Request, res: Response) => {
  const input = createPromoSchema.parse(req.body);

  // Resolve a unique code (retry a few times if a generated one collides).
  let code = input.code;
  if (!code) {
    for (let i = 0; i < 5; i++) {
      const candidate = generatePromoCode();
      const [exists] = await db.select({ id: promoCode.id }).from(promoCode).where(eq(promoCode.code, candidate)).limit(1);
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new AppError(500, "Could not generate a unique promo code");
  } else {
    const [exists] = await db.select({ id: promoCode.id }).from(promoCode).where(eq(promoCode.code, code)).limit(1);
    if (exists) throw new AppError(409, "A promo code with that code already exists");
  }

  const [row] = await db
    .insert(promoCode)
    .values({
      code,
      credits: input.credits,
      maxRedemptions: input.maxRedemptions ?? null,
      perAccountLimit: input.perAccountLimit ?? 1,
      startsAt: input.startsAt ?? null,
      expiresAt: input.expiresAt ?? null,
      note: input.note ?? null,
      createdBy: req.user!.id,
    })
    .returning();
  if (!row) throw new AppError(500, "Failed to create promo code");

  await writeAudit(req, { action: "promo.create", resourceType: "promo_code", resourceId: row.id, metadata: { code: row.code, credits: row.credits } });
  return res.status(201).json(row);
};

// GET /api/v1/admin/promo — list promo codes with redemption counts.
export const listPromos = async (_req: Request, res: Response) => {
  const rows = await db.select().from(promoCode).orderBy(desc(promoCode.createdAt)).limit(200);
  return res.json({ promos: rows });
};

// PATCH /api/v1/admin/promo/:id { status } — disable/enable a promo.
export const updatePromo = async (req: Request, res: Response) => {
  const id = String(req.params.id ?? "");
  if (!UUID_RE.test(id)) throw new AppError(404, "Promo code not found");
  const status = req.body?.status;
  if (status !== "active" && status !== "disabled") throw new AppError(400, "status must be 'active' or 'disabled'");

  const [row] = await db.update(promoCode).set({ status }).where(eq(promoCode.id, id)).returning();
  if (!row) throw new AppError(404, "Promo code not found");

  await writeAudit(req, { action: "promo.update", resourceType: "promo_code", resourceId: id, metadata: { status } });
  return res.json(row);
};

// GET /api/v1/admin/credits/lookup?email=|ownerId= — resolve a user + current
// balance + recent ledger activity, so the admin can confirm the target before granting.
export const lookupUserCredits = async (req: Request, res: Response) => {
  const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
  const ownerId = typeof req.query.ownerId === "string" ? req.query.ownerId.trim() : "";
  if (!email && !ownerId) throw new AppError(400, "email or ownerId is required");

  const [u] = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(ownerId ? eq(user.id, ownerId) : eq(user.email, email))
    .limit(1);
  if (!u) throw new AppError(404, "No user with that email or id");

  const balance = await creditBridge.balance(u.id);
  const recent = await db
    .select({ delta: credit_ledger.delta, reason: credit_ledger.reason, eventId: credit_ledger.eventId, balanceAfter: credit_ledger.balanceAfter, createdAt: credit_ledger.createdAt })
    .from(credit_ledger)
    .where(eq(credit_ledger.userId, u.id))
    .orderBy(desc(credit_ledger.createdAt))
    .limit(20);

  return res.json({
    user: u,
    balance,
    recent: recent.map((r) => ({ delta: Number(r.delta), reason: r.reason, ref: r.eventId, balance_after: Number(r.balanceAfter), created_at: r.createdAt })),
  });
};

// POST /api/v1/admin/credits/grant { ownerId | email, amount, note } — manual grant.
export const grantCredits = async (req: Request, res: Response) => {
  const { ownerId, email, amount, note } = adminGrantSchema.parse(req.body);

  let targetId = ownerId;
  if (!targetId && email) {
    const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
    if (!u) throw new AppError(404, "No user with that email");
    targetId = u.id;
  }
  if (!targetId) throw new AppError(400, "ownerId or email is required");

  const ref = "admin:" + nano(16);
  const { balance } = await creditBridge.grant({ ownerId: targetId, amount, source: "admin_grant", ref });

  await writeAudit(req, { action: "credits.grant", resourceType: "user", resourceId: targetId, metadata: { amount, note: note ?? null, ref } });
  return res.json({ ownerId: targetId, granted: amount, balance });
};

// GET /api/v1/admin/pricing — current credit packs + signup grant (editable).
export const getPricing = async (_req: Request, res: Response) => {
  return res.json(await getPricingConfig());
};

// PATCH /api/v1/admin/pricing — replace the packs + signup grant (stored in app_settings).
export const updatePricing = async (req: Request, res: Response) => {
  const cfg = updatePricingSchema.parse(req.body);
  const ids = new Set(cfg.packs.map((p) => p.packId));
  if (ids.size !== cfg.packs.length) throw new AppError(400, "Pack ids must be unique");

  await setPricingConfig(cfg);
  await writeAudit(req, { action: "pricing.update", resourceType: "settings", resourceId: "pricing", metadata: { packs: cfg.packs.length, signupGrantCredits: cfg.signupGrantCredits } });
  return res.json(cfg);
};

// PATCH /api/v1/admin/api-keys/:id/limit { rateLimitPerMin } — enterprise override.
export const updateKeyLimit = async (req: Request, res: Response) => {
  const id = String(req.params.id ?? "");
  if (!UUID_RE.test(id)) throw new AppError(404, "API key not found");
  const { rateLimitPerMin } = updateKeyLimitSchema.parse(req.body);

  const [row] = await db.update(apiKey).set({ rateLimitPerMin }).where(eq(apiKey.id, id)).returning();
  if (!row) throw new AppError(404, "API key not found");

  await writeAudit(req, { action: "apikey.limit", resourceType: "api_key", resourceId: id, metadata: { rateLimitPerMin } });
  return res.json({ id: row.id, rate_limit_per_min: row.rateLimitPerMin });
};
