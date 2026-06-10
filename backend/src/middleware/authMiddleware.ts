import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.ts";

// Make req.user available and typed across the app.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: string; email: string };
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
