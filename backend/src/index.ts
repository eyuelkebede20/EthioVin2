import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import vinRoutes from "./routes/vinRoutes.ts";
import adminRoutes from "./routes/adminRoutes.ts";
import decodeRoutes from "./routes/decodeRoutes.ts";
import garageRoutes from "./routes/garageRoutes.ts";
import insuranceRoutes from "./routes/insuranceRoutes.ts";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.ts";
import { attachUser, requireRole, requireOrg } from "./middleware/authMiddleware.ts";
import { errorHandler, notFound } from "./middleware/errorHandler.ts";
import "dotenv/config";

// Allowed CORS origins come from FRONTEND_URL (comma-separated for multiple).
// Trailing slashes are stripped so "https://site.com/" matches origin "https://site.com".
const allowedOrigins = (process.env.FRONTEND_URL ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);
if (allowedOrigins.length === 0) {
  throw new Error("FRONTEND_URL environment variable is required");
}

const app = express();

// Don't advertise the framework/version to clients.
app.disable("x-powered-by");

// Behind cPanel/LiteSpeed (and most hosts) requests arrive via a reverse proxy
// that sets X-Forwarded-For. Trust one proxy hop so req.ip is the real client IP
// — without this, express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set("trust proxy", 1);

// Security headers (HSTS, X-Content-Type-Options, frameguard, referrer policy, …).
// This is a JSON API consumed by a SEPARATE frontend origin: CSP only governs HTML
// documents (we serve none) and helmet's default Cross-Origin-Resource-Policy of
// "same-origin" would needlessly complicate cross-origin use, so both are relaxed
// while every other hardening header is kept.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser/no-Origin requests, and any configured frontend origin.
      if (!origin || allowedOrigins.includes(origin.replace(/\/+$/, ""))) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // Identity must come from the better-auth session cookie, never a client
    // header — so x-user-id is deliberately NOT allowed.
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Liveness/readiness probe for the host + CI. Public and un-throttled so a
// monitor can hit it freely; reveals nothing beyond "the process is up".
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Throttle credential endpoints to blunt brute-force / credential-stuffing.
// Scoped to sign-in/sign-up so it doesn't throttle session polling (get-session).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(["/api/auth/sign-in", "/api/auth/sign-up"], authLimiter);

// better-auth must see the raw body, so it runs before express.json().
// Match the mount exactly or as a path prefix — a bare startsWith("/api/auth")
// would also capture unrelated paths like "/api/auth-status".
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.url === "/api/auth" || req.url.startsWith("/api/auth/")) {
    return toNodeHandler(auth)(req, res);
  }
  next();
});

app.use(express.json({ limit: "100kb" }));

// Resolve the session once and hang the user on req.user for everyone downstream.
app.use(attachUser);

// Rate limiting for app endpoints (incl. the paid Gemini/Serper ones).
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });

app.use("/api/v1/vin", apiLimiter, vinRoutes);

// Public decode funnel: GET /api/v1/decode/:vin is intentionally un-authed (free
// tier). attachUser still ran, so a logged-in premium user's /full sub-route can
// resolve their tier. Rate-limited like the rest of the app surface.
app.use("/api/v1/decode", apiLimiter, decodeRoutes);

// Garage management — gated to garage-org members; every handler scopes by req.org.id.
app.use("/api/v1/garage", apiLimiter, requireOrg("garage"), garageRoutes);

// Insurance reciprocal exchange — gated to insurer-org members (+ an active
// data-sharing agreement, enforced per-handler). Minimized intake, insurer-view egress.
app.use("/api/v1/insurance", apiLimiter, requireOrg("insurer"), insuranceRoutes);

// Admin router is role-gated. requireRole already rejects unauthenticated users,
// so it's used alone (not stacked with requireAuth).
app.use("/api/v1/admin", requireRole("super_admin", "garage_admin"), adminRoutes);

// 404 + central error handler (must be last).
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (allowed origins: ${allowedOrigins.join(", ")})`);
});
