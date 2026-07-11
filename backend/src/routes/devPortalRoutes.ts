import { Router } from "express";
import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { requireAuth } from "../middleware/authMiddleware.ts";
import { listKeys, createKey, deleteKey, usageSummary, demoDecode, listDemoVins } from "../controllers/devPortalController.ts";
import { listPacks, checkout, getPurchase, redeemPromo, billingHistory } from "../controllers/billingController.ts";

// Blunt promo-code enumeration: 10 redeem attempts / 15 min per account.
const promoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  // Prefer the account id; fall back to a v6-safe IP key for unauthenticated hits.
  keyGenerator: (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? "0.0.0.0"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many promo attempts. Please try again later." },
});

// Developer portal API — session-authed. Gated PER-ROUTE with requireAuth (NOT at
// mount): the Chapa webhook is unauthenticated (signature-verified) and lives OUTSIDE
// this router, registered before express.json() in index.ts. requireAuth (not
// requireRole): being an API customer is orthogonal to M1/M2 contributor roles.
const router = Router();

// --- Landing-page live demo (PUBLIC, keyless, no credits) ---
const demoLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? "0.0.0.0"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many demo requests. Please slow down." },
});
router.get("/demo", demoLimiter, listDemoVins);
router.get("/demo/:vin", demoLimiter, demoDecode);

// --- API keys ---
router.get("/keys", requireAuth, listKeys);
router.post("/keys", requireAuth, createKey);
router.delete("/keys/:id", requireAuth, deleteKey);

// --- Billing (packs / checkout / promo / history) ---
router.get("/billing/packs", requireAuth, listPacks);
router.post("/billing/checkout", requireAuth, checkout);
router.get("/billing/purchase/:txRef", requireAuth, getPurchase);
router.post("/billing/promo", requireAuth, promoLimiter, redeemPromo);
router.get("/billing/history", requireAuth, billingHistory);

// --- Dashboard usage aggregates ---
router.get("/usage/summary", requireAuth, usageSummary);

export default router;
