import { Router } from "express";
import { processVin, submitVerifiedSpec, getVehicleImages, getConflicts, generateDraft, resolveConflict, saveVehicleToLedger } from "../controllers/vinController";
import { requireAuth, requireRole } from "../middleware/authMiddleware";

const router = Router();

// Anyone logged in can scan
router.post("/scan", requireAuth, processVin);

// Only admins and diagnosticians can submit new specs
router.post("/verify", requireRole(["super_admin", "garage_admin", "diagnostician"]), submitVerifiedSpec);

// Only super admins can manage WMI conflicts
router.get("/conflicts", requireRole(["super_admin"]), getConflicts);
router.post("/resolve", requireRole(["super_admin"]), resolveConflict);

router.post("/generate-draft", requireAuth, generateDraft);
router.post("/log", requireAuth, saveVehicleToLedger);

router.post("/images", requireAuth, getVehicleImages);
export default router;
