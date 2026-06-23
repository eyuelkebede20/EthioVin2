import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq } from "drizzle-orm";
import { auth } from "../auth.ts";
import { db } from "../db/index.ts";
import { organization_members, organizations, premium_access } from "../db/schema.ts";

// Make req.user available and typed across the app.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: string; email: string };
      // Set by requireOrg: the org this user acts on behalf of for this request.
      org?: { id: string; type: string; role: string };
      // Set by requireTier: the access tier resolved for this request.
      tier?: "free" | "premium";
    }
  }
}

/**
 * attachUser: resolves the better-auth session and puts the user on req.user.
 * Never rejects — public/optional-auth routes still work. Apply this globally.
 */
export const attachUser = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (result?.user) req.user = result.user as { id: string; role: string; email: string };
  } catch {
    // No valid session — leave req.user undefined and continue.
  }
  next();
};

/**
 * requireAuth: blocks anyone without a valid session. Use ALONE for routes any
 * logged-in user may hit (it does NOT check roles — see requireRole for that).
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
  next();
};

/**
 * requireRole: blocks anyone whose role isn't in the allow-list. Takes SPREAD
 * args (not an array). Already rejects unauthenticated users, so use it ALONE —
 * don't stack it with requireAuth.
 */
export const requireRole =
  (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };

/**
 * requireOrg: the user must belong to an organization (optionally of one of the
 * given types: "garage" | "insurer" | "diagnostic"). Resolves the membership and
 * hangs `req.org = { id, type, role }` for downstream org-scoping. Takes SPREAD
 * type args (like requireRole); no args = any org. This is the boundary that
 * stops org A from touching org B's data — controllers scope by `req.org.id`.
 */
export const requireOrg =
  (...types: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    try {
      const rows = await db
        .select({ orgId: organization_members.orgId, orgRole: organization_members.orgRole, type: organizations.type })
        .from(organization_members)
        .innerJoin(organizations, eq(organization_members.orgId, organizations.id))
        .where(eq(organization_members.userId, req.user.id));
      const match = types.length ? rows.find((r) => types.includes(r.type)) : rows[0];
      if (!match) return res.status(403).json({ error: "Not a member of a permitted organization" });
      req.org = { id: match.orgId, type: match.type, role: match.orgRole };
      next();
    } catch (err) {
      next(err);
    }
  };

/**
 * requireTier: gate premium-only data. super_admin always passes. Otherwise the
 * user needs an active, unexpired premium_access row. Returns 402 (Payment
 * Required) when the gate is closed so the client can show the upgrade flow.
 * The free/premium SPLIT lives in the serializer — this only decides access.
 */
export const requireTier =
  (tier: "premium") =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (req.user.role === "super_admin") {
      req.tier = "premium";
      return next();
    }
    try {
      const [row] = await db
        .select({ tier: premium_access.tier, status: premium_access.status, expiresAt: premium_access.expiresAt })
        .from(premium_access)
        .where(and(eq(premium_access.userId, req.user.id), eq(premium_access.tier, "premium"), eq(premium_access.status, "active")))
        .limit(1);
      const active = row && (!row.expiresAt || row.expiresAt > new Date());
      if (!active) return res.status(402).json({ error: "Premium access required", upgrade: true });
      req.tier = tier;
      next();
    } catch (err) {
      next(err);
    }
  };
