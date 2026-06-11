import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import vinRoutes from "./routes/vinRoutes.ts";
import adminRoutes from "./routes/adminRoutes.ts";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.ts";
import { attachUser, requireRole } from "./middleware/authMiddleware.ts";
import { errorHandler, notFound } from "./middleware/errorHandler.ts";
import "dotenv/config";

// Fail fast on misconfiguration rather than silently allowing a broken/insecure
// CORS origin like "undefined".
const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL) {
  throw new Error("FRONTEND_URL environment variable is required");
}

const app = express();

// Behind cPanel/LiteSpeed (and most hosts) requests arrive via a reverse proxy
// that sets X-Forwarded-For. Trust one proxy hop so req.ip is the real client IP
// — without this, express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set("trust proxy", 1);

app.use(
  cors({
    origin: [FRONTEND_URL],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // Identity must come from the better-auth session cookie, never a client
    // header — so x-user-id is deliberately NOT allowed.
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

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
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.url.startsWith("/api/auth")) {
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

// Admin router is role-gated. requireRole already rejects unauthenticated users,
// so it's used alone (not stacked with requireAuth).
app.use("/api/v1/admin", requireRole("super_admin", "garage_admin"), adminRoutes);

// 404 + central error handler (must be last).
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (frontend: ${FRONTEND_URL})`);
});
