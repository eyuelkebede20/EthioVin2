import type { Request, Response } from "express";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { apiKey, apiRequestLog, apiIdempotency, wmi_mapping } from "../db/schema.ts";
import { parseVin, type ParsedVin } from "../utils/vin.ts";
import { resolveVehicle, type DecodeMatch } from "./decodeController.ts";
import * as creditBridge from "../services/creditBridge.ts";
import { InsufficientCreditsError } from "../services/creditBridge.ts";
import { sha256hex } from "../services/apiKeyService.ts";
import { newRequestId } from "../utils/id.ts";
import { publicDecodeSchema, usageRangeSchema } from "../utils/validation.ts";
import { PublicApiError } from "../middleware/publicApiError.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type LogResult = "exact" | "model" | "parse_only" | "invalid" | "error";

/** Best-effort request log — the billing-dispute record. Never breaks the response. */
async function logRequest(args: {
  requestId: string;
  apiKeyId: string;
  endpoint: string;
  vin: string | null;
  result: LogResult;
  creditsCharged: number;
  httpStatus: number;
  startedAt: number;
  ip: string | null;
}): Promise<void> {
  try {
    await db.insert(apiRequestLog).values({
      requestId: args.requestId,
      apiKeyId: args.apiKeyId,
      endpoint: args.endpoint,
      vin: args.vin,
      result: args.result,
      creditsCharged: args.creditsCharged,
      httpStatus: args.httpStatus,
      latencyMs: Date.now() - args.startedAt,
      ip: args.ip,
    });
  } catch (err) {
    console.error(`[v1] FAILED to write api_request_log for req=${args.requestId}:`, err);
  }
}

function yearToNumber(year: string | null | undefined): number | null {
  return year && /^\d{4}$/.test(year) ? Number(year) : null;
}

async function lookupCountry(wmi: string): Promise<string | null> {
  const [row] = await db.select({ country: wmi_mapping.country }).from(wmi_mapping).where(eq(wmi_mapping.wmi, wmi)).limit(1);
  return row?.country ?? null;
}

function readIdemKey(req: Request): string | null {
  const raw = req.headers["idempotency-key"];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > 64) throw new PublicApiError(422, "invalid_vin", "Idempotency-Key must be at most 64 characters.");
  return trimmed;
}

// ---------------------------------------------------------------------------
// POST /v1/decode — the product. Charging law order is testable (§6).
// ---------------------------------------------------------------------------
export const decode = async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const requestId = newRequestId();
  const keyRow = req.apiKey!;
  const ip = req.ip ?? null;
  const idemKey = readIdemKey(req);

  // 1. Validate the body shape (bounded string — parseVin is the real authority).
  const parsed = publicDecodeSchema.safeParse(req.body);
  if (!parsed.success) {
    await logRequest({ requestId, apiKeyId: keyRow.id, endpoint: "decode", vin: null, result: "invalid", creditsCharged: 0, httpStatus: 422, startedAt, ip });
    throw new PublicApiError(422, "invalid_vin", "A `vin` string is required.");
  }
  const rawVin = parsed.data.vin;
  const requestHash = sha256hex(JSON.stringify({ vin: rawVin }));

  // 2. Idempotency replay — before any decode or charge.
  if (idemKey) {
    const [prior] = await db
      .select()
      .from(apiIdempotency)
      .where(and(eq(apiIdempotency.apiKeyId, keyRow.id), eq(apiIdempotency.idemKey, idemKey)))
      .limit(1);
    if (prior) {
      if (prior.requestHash !== requestHash) {
        throw new PublicApiError(409, "idempotency_conflict", "This Idempotency-Key was already used with a different request body.");
      }
      return res.status(prior.httpStatus).json(prior.response);
    }
  }

  // 3. Clean + 17-char check (parseVin throws AppError(400) on bad length -> map to 422, free).
  let decoded: ParsedVin;
  try {
    decoded = parseVin(rawVin);
  } catch {
    await logRequest({ requestId, apiKeyId: keyRow.id, endpoint: "decode", vin: null, result: "invalid", creditsCharged: 0, httpStatus: 422, startedAt, ip });
    throw new PublicApiError(422, "invalid_vin", "The VIN did not clean to 17 characters.");
  }

  // 4. Decode.
  const { match, identity, specs } = await resolveVehicle(rawVin);
  const country = identity.country ?? (await lookupCountry(decoded.wmi));
  const parsedBlock = {
    wmi: decoded.wmi,
    vds: decoded.vds_code,
    vis: decoded.vis,
    plant_code: decoded.plant,
    model_year: yearToNumber(decoded.year),
    country,
    manufacturer: identity.manufacturer ?? null,
  };

  // 5. Parse-only miss -> free, 0 credits.
  if (match === "none") {
    const balance = await creditBridge.balance(keyRow.ownerId);
    const body = { request_id: requestId, vin: decoded.keyVin, valid: true, match: "none" as DecodeMatch, parsed: parsedBlock, vehicle: null, specs: null, credits: { charged: 0, balance } };
    await logRequest({ requestId, apiKeyId: keyRow.id, endpoint: "decode", vin: decoded.keyVin, result: "parse_only", creditsCharged: 0, httpStatus: 200, startedAt, ip });
    await storeIdempotent(idemKey, keyRow.id, requestHash, 200, body);
    return res.status(200).json(body);
  }

  // 6. Hit (exact|model) -> charge 1 credit as a guarded decrement. Never return paid
  //    data on a failed charge.
  let balanceAfter: number;
  try {
    ({ balance: balanceAfter } = await creditBridge.charge({ ownerId: keyRow.ownerId, amount: 1, source: "api_decode", ref: "decode:" + requestId }));
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      await logRequest({ requestId, apiKeyId: keyRow.id, endpoint: "decode", vin: decoded.keyVin, result: match, creditsCharged: 0, httpStatus: 402, startedAt, ip });
      throw new PublicApiError(402, "insufficient_credits", "Your balance is empty. Top up to continue decoding.");
    }
    throw err;
  }

  const body = {
    request_id: requestId,
    vin: decoded.keyVin,
    valid: true,
    match,
    parsed: parsedBlock,
    vehicle: {
      make: identity.manufacturer ?? null,
      model: identity.model ?? null,
      year: yearToNumber(identity.year),
      image_url: identity.image_url ?? null,
    },
    specs: specs ?? null,
    credits: { charged: 1, balance: balanceAfter },
  };
  await logRequest({ requestId, apiKeyId: keyRow.id, endpoint: "decode", vin: decoded.keyVin, result: match, creditsCharged: 1, httpStatus: 200, startedAt, ip });
  await storeIdempotent(idemKey, keyRow.id, requestHash, 200, body);
  return res.status(200).json(body);
};

/** Persist a successful response for idempotent replay (best-effort; unique constraint races are benign). */
async function storeIdempotent(idemKey: string | null, apiKeyId: string, requestHash: string, httpStatus: number, response: unknown): Promise<void> {
  if (!idemKey) return;
  try {
    await db.insert(apiIdempotency).values({ apiKeyId, idemKey, requestHash, httpStatus, response }).onConflictDoNothing();
  } catch (err) {
    console.error("[v1] idempotency store failed:", err);
  }
}

// ---------------------------------------------------------------------------
// GET /v1/account — balance, calling-key info, month-to-date usage (account-wide).
// ---------------------------------------------------------------------------
export const account = async (req: Request, res: Response) => {
  const keyRow = req.apiKey!;
  const balance = await creditBridge.balance(keyRow.ownerId);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [agg] = await db
    .select({
      decodes: sql<number>`count(*) filter (where ${apiRequestLog.result} in ('exact','model','parse_only'))::int`,
      creditsSpent: sql<number>`coalesce(sum(${apiRequestLog.creditsCharged}), 0)::int`,
    })
    .from(apiRequestLog)
    .innerJoin(apiKey, eq(apiRequestLog.apiKeyId, apiKey.id))
    .where(and(eq(apiKey.ownerId, keyRow.ownerId), gte(apiRequestLog.createdAt, monthStart)));

  return res.json({
    balance,
    key: { name: keyRow.name, prefix: keyRow.keyPrefix, rate_limit_per_min: keyRow.rateLimitPerMin },
    usage_this_month: { decodes: agg?.decodes ?? 0, credits_spent: agg?.creditsSpent ?? 0 },
  });
};

// ---------------------------------------------------------------------------
// GET /v1/usage?from&to — per-day counts (account-wide). Max range 92 days.
// ---------------------------------------------------------------------------
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(s: string): Date {
  const d = new Date(s + "T00:00:00.000Z");
  if (Number.isNaN(d.getTime())) throw new PublicApiError(422, "invalid_vin", "Dates must be valid YYYY-MM-DD.");
  return d;
}
function fmtDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const usage = async (req: Request, res: Response) => {
  const keyRow = req.apiKey!;
  const { from, to } = usageRangeSchema.parse(req.query);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const toDate = to ? parseDay(to) : today;
  let fromDate = from ? parseDay(from) : new Date(toDate.getTime() - 29 * DAY_MS);
  // Clamp to a 92-day window rather than erroring on an over-wide range.
  if (toDate.getTime() - fromDate.getTime() > 91 * DAY_MS) fromDate = new Date(toDate.getTime() - 91 * DAY_MS);
  // Inclusive upper bound: rows up to end of `to` day.
  const upper = new Date(toDate.getTime() + DAY_MS);

  const days = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${apiRequestLog.createdAt}), 'YYYY-MM-DD')`,
      decodes: sql<number>`count(*) filter (where ${apiRequestLog.result} in ('exact','model','parse_only'))::int`,
      hits: sql<number>`count(*) filter (where ${apiRequestLog.result} in ('exact','model'))::int`,
      credits_spent: sql<number>`coalesce(sum(${apiRequestLog.creditsCharged}), 0)::int`,
    })
    .from(apiRequestLog)
    .innerJoin(apiKey, eq(apiRequestLog.apiKeyId, apiKey.id))
    .where(and(eq(apiKey.ownerId, keyRow.ownerId), gte(apiRequestLog.createdAt, fromDate), lte(apiRequestLog.createdAt, upper)))
    .groupBy(sql`date_trunc('day', ${apiRequestLog.createdAt})`)
    .orderBy(sql`date_trunc('day', ${apiRequestLog.createdAt})`);

  return res.json({ from: fmtDay(fromDate), to: fmtDay(toDate), days });
};
