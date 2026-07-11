import type { Request, Response } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { apiKey, apiRequestLog, creditPurchase, wmi_mapping } from "../db/schema.ts";
import { AppError } from "../middleware/errorHandler.ts";
import { createApiKey, listApiKeys, revokeApiKey } from "../services/apiKeyService.ts";
import * as creditBridge from "../services/creditBridge.ts";
import { resolveVehicle } from "./decodeController.ts";
import { parseVin } from "../utils/vin.ts";
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

const DAY_MS = 24 * 60 * 60 * 1000;

// GET /api/v1/dev/usage/summary — dashboard aggregates for the caller's account
// (all their keys): balance + last-30-day daily decodes/hits/credits + totals.
export const usageSummary = async (req: Request, res: Response) => {
  const ownerId = req.user!.id;
  const balance = await creditBridge.balance(ownerId);

  const since = new Date(Date.now() - 29 * DAY_MS);
  since.setUTCHours(0, 0, 0, 0);

  const days = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${apiRequestLog.createdAt}), 'YYYY-MM-DD')`,
      decodes: sql<number>`count(*) filter (where ${apiRequestLog.result} in ('exact','model','parse_only'))::int`,
      hits: sql<number>`count(*) filter (where ${apiRequestLog.result} in ('exact','model'))::int`,
      credits_spent: sql<number>`coalesce(sum(${apiRequestLog.creditsCharged}), 0)::int`,
    })
    .from(apiRequestLog)
    .innerJoin(apiKey, eq(apiRequestLog.apiKeyId, apiKey.id))
    .where(and(eq(apiKey.ownerId, ownerId), gte(apiRequestLog.createdAt, since)))
    .groupBy(sql`date_trunc('day', ${apiRequestLog.createdAt})`)
    .orderBy(sql`date_trunc('day', ${apiRequestLog.createdAt})`);

  const totals = days.reduce(
    (acc, d) => ({ decodes: acc.decodes + d.decodes, hits: acc.hits + d.hits, credits_spent: acc.credits_spent + d.credits_spent }),
    { decodes: 0, hits: 0, credits_spent: 0 },
  );
  const hitRatio = totals.decodes > 0 ? Math.round((totals.hits / totals.decodes) * 100) : 0;

  return res.json({ balance, since: since.toISOString().slice(0, 10), days, totals: { ...totals, hit_ratio: hitRatio } });
};

// A small, fixed set of sample VINs for the landing-page live demo. Canned-only so
// there's nothing for scrapers to farm and no AI/Serper cost. Swap these for real
// already-cached VINs from the seeded DB before launch.
const DEMO_VINS = ["LGXC16CF0N0000001", "JHMGE8H50DC000001", "MMBJNKA10JH000001"];

// GET /api/v1/dev/demo/:vin — PUBLIC, keyless, no credits. Decodes only the canned
// sample VINs and returns the public /v1 envelope shape (minus credits). Per-IP limited.
export const demoDecode = async (req: Request, res: Response) => {
  const raw = String(req.params.vin ?? "").trim().toUpperCase();
  if (!DEMO_VINS.includes(raw)) throw new AppError(400, "Only the provided sample VINs can be decoded in the demo.");

  const decoded = parseVin(raw);
  const { match, identity, specs } = await resolveVehicle(raw);
  const [wmiRow] = await db.select({ country: wmi_mapping.country }).from(wmi_mapping).where(eq(wmi_mapping.wmi, decoded.wmi)).limit(1);
  const modelYear = /^\d{4}$/.test(decoded.year) ? Number(decoded.year) : null;

  return res.json({
    vin: decoded.keyVin,
    valid: true,
    match,
    parsed: {
      wmi: decoded.wmi,
      vds: decoded.vds_code,
      vis: decoded.vis,
      plant_code: decoded.plant,
      model_year: modelYear,
      country: identity.country ?? wmiRow?.country ?? null,
      manufacturer: identity.manufacturer ?? null,
    },
    vehicle:
      match === "none"
        ? null
        : { make: identity.manufacturer ?? null, model: identity.model ?? null, year: modelYear, image_url: identity.image_url ?? null },
    specs: match === "none" ? null : specs ?? null,
    demo: true,
  });
};

/** The canned demo VIN list, exposed so the portal can render the dropdown. */
export const listDemoVins = (_req: Request, res: Response) => {
  return res.json({ vins: DEMO_VINS });
};
