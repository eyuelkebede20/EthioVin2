import { Router } from "express";
import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/authMiddleware.ts";
import { listKeys, createKey, deleteKey } from "../controllers/devPortalController.ts";
import { listPacks, checkout, getPurchase, redeemPromo, billingHistory } from "../controllers/billingController.ts";

// Blunt promo-code enumeration: 10 redeem attempts / 15 min per account.
const promoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req: Request) => req.user?.id ?? req.ip ?? "anon",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many promo attempts. Please try again later." },
});

// Developer portal API — session-authed. Gated PER-ROUTE with requireAuth (NOT at
// mount): the Chapa webhook is unauthenticated (signature-verified) and lives OUTSIDE
// this router, registered before express.json() in index.ts. requireAuth (not
// requireRole): being an API customer is orthogonal to M1/M2 contributor roles.
const router = Router();

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

export default router;
