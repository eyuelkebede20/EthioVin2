import type { Request, Response, NextFunction } from "express";
import { auth } from "../auth";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Attach user to request for downstream controllers (e.g., saveVehicleToLedger)
    req.headers["x-user-id"] = session.user.id;
    next();
  } catch (error) {
    return res.status(500).json({ error: "Authentication error" });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session || !session.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!allowedRoles.includes(session.user.role)) {
      return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
    }

    req.user = session.user;
    next();
  };
};
