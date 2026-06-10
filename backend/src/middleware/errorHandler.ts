import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

/**
 * Operational error with an HTTP status. Throw this from controllers; Express 5
 * forwards rejected promises to the error handler below automatically.
 */
export class AppError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

/** 404 for unmatched routes. Mount after all routers. */
export const notFound = (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
};

/**
 * Central error handler. Mount last. Translates known error shapes to clean
 * `{ error }` responses and never leaks internals/stack traces to clients.
 */
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // Validation errors -> 400 with a readable message.
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path.join(".");
    const message = first ? `${path ? `${path}: ` : ""}${first.message}` : "Invalid request";
    return res.status(400).json({ error: message });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Anything else is unexpected: log server-side, return a generic message.
  console.error("[unhandled]", err);
  return res.status(500).json({ error: "Internal server error" });
};
