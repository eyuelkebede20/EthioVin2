import type { Request, Response, NextFunction } from "express";
import { db } from "../db/index.ts";
import { audit_log } from "../db/schema.ts";

interface AuditEntry {
  action: string;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
  orgId?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * writeAudit: append one row to the immutable audit_log. Call this from a
 * controller when the resourceId is known (e.g. after reading an insurance
 * claim or changing a trust score). Identity comes from the session
 * (req.user), never a header.
 *
 * Audit must NOT break the request it records — but a write failure must be
 * VISIBLE, not silent. On failure we log to stderr with full context so the
 * monitor/alert can catch it (see Observability in the plan).
 */
export async function writeAudit(req: Request, entry: AuditEntry): Promise<void> {
  try {
    await db.insert(audit_log).values({
      actorUserId: req.user?.id ?? null,
      action: entry.action,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      orgId: entry.orgId ?? req.org?.id ?? null,
      ip: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch (err) {
    console.error(`[audit] FAILED to write audit log for action="${entry.action}" resource=${entry.resourceType}/${entry.resourceId}:`, err);
  }
}

/**
 * audit: middleware that records a successful (status < 400) request against a
 * sensitive route. Use for blanket access logging where the resourceId isn't
 * known up front (it logs the path + status). For precise resource logging,
 * prefer writeAudit() inside the controller.
 */
export const audit =
  (action: string, resourceType?: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      if (res.statusCode < 400) {
        void writeAudit(req, {
          action,
          resourceType,
          metadata: { status: res.statusCode, method: req.method, path: req.originalUrl },
        });
      }
    });
    next();
  };
