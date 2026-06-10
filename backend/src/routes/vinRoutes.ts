import { Router } from "express";
import { processVin, submitVerifiedSpec, getVehicleImages, getConflicts, generateDraft, resolveConflict, saveVehicleToLedger } from "../controllers/vinController.ts";
import { requireAuth, requireRole } from "../middleware/authMiddleware.ts";
import rateLimit from "express-rate-limit";

const externalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Rate limit exceeded. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// Anyone logged in can scan
router.post("/scan", requireAuth, processVin);

router.post("/verify", requireRole("super_admin", "garage_admin", "diagnostician"), submitVerifiedSpec);
router.get("/conflicts", requireRole("super_admin"), getConflicts);
router.post("/resolve", requireRole("super_admin"), resolveConflict);
router.post("/generate-draft", requireRole("super_admin", "garage_admin", "diagnostician"), externalApiLimiter, generateDraft);
router.post("/log", requireRole("super_admin", "garage_admin", "diagnostician"), saveVehicleToLedger);
router.post("/images", requireRole("super_admin", "garage_admin", "diagnostician"), externalApiLimiter, getVehicleImages);
export default router;
