import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { apiKey, creditPurchase } from "../db/schema.ts";
import { AppError } from "../middleware/errorHandler.ts";
import { createApiKey, listApiKeys, revokeApiKey } from "../services/apiKeyService.ts";
import * as creditBridge from "../services/creditBridge.ts";
import { createKeySchema } from "../utils/validation.ts";
import { SIGNUP_GRANT_CREDITS, FREE_RATE_LIMIT_PER_MIN, PAID_RATE_LIMIT_PER_MIN } from "../lib/pricing.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Has the account ever completed a purchase? Decides the default rate-limit tier. */
async function ownerHasPaidPurchase(ownerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: creditPurchase.id })
    .from(creditPurchase)
    .where(and(eq(creditPurchase.ownerId, ownerId), eq(creditPurchase.status, "paid")))
    .limit(1);
  return !!row;
}

function publicKeyShape(k: Awaited<ReturnType<typeof listApiKeys>>[number]) {
  return {
    id: k.id,
    name: k.name,
    prefix: k.keyPrefix,
    last4: k.last4,
    status: k.status,
    rate_limit_per_min: k.rateLimitPerMin,
    last_used_at: k.lastUsedAt,
    expires_at: k.expiresAt,
    created_at: k.createdAt,
    revoked_at: k.revokedAt,
  };
}

// GET /api/v1/dev/keys — list the caller's keys (never hashes).
export const listKeys = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const rows = await listApiKeys(ownerId);
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return res.json({ keys: rows.map(publicKeyShape) });
};

// POST /api/v1/dev/keys { name } — create a key; raw value returned ONCE. The
// first-ever key for the account also fires the one-time signup grant.
export const createKey = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const { name } = createKeySchema.parse(req.body);

  const hasPaid = await ownerHasPaidPurchase(ownerId);
  const rateLimitPerMin = hasPaid ? PAID_RATE_LIMIT_PER_MIN : FREE_RATE_LIMIT_PER_MIN;

  const priorKeys = await db.select({ id: apiKey.id }).from(apiKey).where(eq(apiKey.ownerId, ownerId)).limit(1);
  const isFirstKey = priorKeys.length === 0;

  const { raw, record } = await createApiKey({ ownerId, name, rateLimitPerMin });

  let grantedCredits = 0;
  if (isFirstKey) {
    // Idempotent per account: the unique ledger ref makes the grant un-farmable.
    const ref = "signup:" + ownerId;
    if (!(await creditBridge.hasGrantRef(ownerId, ref))) {
      try {
        await creditBridge.grant({ ownerId, amount: SIGNUP_GRANT_CREDITS, source: "signup_grant", ref });
        grantedCredits = SIGNUP_GRANT_CREDITS;
      } catch (err) {
        console.error(`[dev] signup grant failed for ${ownerId}:`, err);
      }
    }
  }

  return res.status(201).json({
    id: record.id,
    name: record.name,
    // The raw key — shown ONCE. There is no recovery.
    key: raw,
    prefix: record.keyPrefix,
    last4: record.last4,
    rate_limit_per_min: record.rateLimitPerMin,
    created_at: record.createdAt,
    signup_grant_credits: grantedCredits,
  });
};

// DELETE /api/v1/dev/keys/:id — revoke one of the caller's keys.
export const deleteKey = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const id = String(req.params.id ?? "");
  if (!UUID_RE.test(id)) throw new AppError(404, "API key not found");

  const [row] = await db.select({ id: apiKey.id }).from(apiKey).where(and(eq(apiKey.id, id), eq(apiKey.ownerId, ownerId))).limit(1);
  if (!row) throw new AppError(404, "API key not found");

  await revokeApiKey(id);
  return res.json({ id, status: "revoked" });
};
