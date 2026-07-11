import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "./errorHandler.ts";

// The /v1 public surface has its OWN frozen error envelope — never the internal
// `{ error: "..." }` string shape. Both are separate public contracts; do not merge.
//   { "error": { "code": "...", "message": "...", "doc_url"?: "..." } }

/** Throw-based public error carrying a stable machine `code` (Express 5 forwards async throws). */
export class PublicApiError extends AppError {
  code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(statusCode, message);
    this.name = "PublicApiError";
    this.code = code;
  }
}

function docUrl(): string | undefined {
  const base = (process.env.PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
  return base ? `${base}/developers/docs#errors` : undefined;
}

function envelope(code: string, message: string) {
  const url = docUrl();
  return url ? { error: { code, message, doc_url: url } } : { error: { code, message } };
}

/** 404 for unmatched /v1 routes (mounted at the END of the /v1 router). */
export const publicNotFound = (_req: Request, res: Response) => {
  res.status(404).json(envelope("not_found", "Unknown endpoint. See the API reference."));
};

/** Router-level error handler for /v1 — keeps errors out of the global handler. */
export const publicErrorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);

  // A malformed body (missing/oversized vin) — the contract only exposes documented
  // codes, so map validation failures to the closest one.
  if (err instanceof ZodError) {
    return res.status(422).json(envelope("invalid_vin", "Invalid request body."));
  }

  if (err instanceof PublicApiError) {
    return res.status(err.statusCode).json(envelope(err.code, err.message));
  }

  // A generic AppError shouldn't normally reach /v1 (controllers throw PublicApiError),
  // but if one does, don't leak its internals — treat as a server error.
  console.error(`[${new Date().toISOString()}] [v1 unhandled] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json(envelope("server_error", "Something broke on our side."));
};

export function publicUnauthorized(): PublicApiError {
  // A 401 must not disclose WHY (missing vs unknown vs revoked vs expired).
  return new PublicApiError(401, "unauthorized", "Invalid API key");
}
