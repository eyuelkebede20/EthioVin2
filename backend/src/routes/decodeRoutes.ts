import { Router } from "express";
import { publicDecode, premiumDecode } from "../controllers/decodeController.ts";
import { requireAuth, requireTier } from "../middleware/authMiddleware.ts";

const router = Router();

// PUBLIC — no auth. The free-tier funnel surface (still rate-limited at the mount).
router.get("/:vin", publicDecode);

// Premium — must be logged in AND hold premium access (requireTier returns 402 if not).
router.get("/:vin/full", requireAuth, requireTier("premium"), premiumDecode);

export default router;
