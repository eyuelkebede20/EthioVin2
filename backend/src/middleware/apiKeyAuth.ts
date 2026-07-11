import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { resolveApiKey, touchLastUsed, type ApiKeyRecord } from "../services/apiKeyService.ts";
import { publicUnauthorized } from "./publicApiError.ts";

// The public /v1 identity channel. Disjoint from the session channel: /v1 NEVER
// reads cookies/sessions, and /api/v1/dev/* NEVER accepts API keys. Charging
// identity is req.apiKey.ownerId, resolved server-side from the key hash.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKey?: ApiKeyRecord;
    }
  }
}

/** Extract a raw key from `Authorization: Bearer …` or `X-API-Key`. */
function extractRawKey(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const x = req.headers["x-api-key"];
  if (typeof x === "string" && x.trim()) return x.trim();
  return undefined;
}

/**
 * requireApiKey: resolve the presented key to an active record, or 401 with the
 * uniform message. Never logs the raw key or Authorization header.
 */
export const requireApiKey = async (req: Request, _res: Response, next: NextFunction) => {
  const raw = extractRawKey(req);
  if (!raw) throw publicUnauthorized();
  const key = await resolveApiKey(raw);
  if (!key) throw publicUnauthorized();
  req.apiKey = key;
  touchLastUsed(key); // fire-and-forget, >60s stale only
  next();
};

// --- Limiters (memory store; per-process — see claude.milestone3.md §5) --------

/** Generous per-IP backstop: one box can't melt the app even with many keys. */
export const ipFloodLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: { code: "rate_limited", message: "Too many requests from this IP." } }),
});

/** Blunt key brute-force: count ONLY 401s per IP (belt-and-braces vs 256-bit keys). */
export const invalidKeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true, // "successful" = not a 401 (see requestWasSuccessful)
  requestWasSuccessful: (_req, res) => res.statusCode !== 401,
  handler: (_req, res) => res.status(429).json({ error: { code: "rate_limited", message: "Too many failed authentications." } }),
});

/** The tier limit — dynamic per key (NOT per IP; corporate NAT shares IPs). */
export const perKeyLimiter = rateLimit({
  windowMs: 60_000,
  keyGenerator: (req: Request) => req.apiKey!.id,
  limit: (req: Request) => req.apiKey!.rateLimitPerMin,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ error: { code: "rate_limited", message: "Rate limit exceeded. Retry after the window resets." } }),
});
