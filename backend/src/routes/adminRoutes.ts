import { Router } from "express";
import { requireRole } from "../middleware/authMiddleware.ts";
import { getUnknownWMIs, updateWMI, getDistinctManufacturers } from "../controllers/adminController.ts";

const router = Router();

// Restrict to super_admin (no brackets — requireRole takes spread args)
router.get("/wmi/unknown", requireRole("super_admin"), getUnknownWMIs);
router.put("/wmi/update", requireRole("super_admin"), updateWMI);
router.get("/wmi/manufacturers", requireRole("super_admin"), getDistinctManufacturers);

export default router;
