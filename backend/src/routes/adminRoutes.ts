import { Router } from "express";
import { requireRole, requireAuth } from "../middleware/authMiddleware.ts";
import { getUnknownWMIs, updateWMI, getManufacturers, getDistinctManufacturers } from "../controllers/adminController.ts";

const router = Router();

// Restrict to super_admin
router.get("/wmi/unknown", requireRole(["super_admin"]), getUnknownWMIs);
router.put("/wmi/update", requireRole(["super_admin"]), updateWMI);
router.get("/wmi/manufacturers", requireRole(["super_admin"]), getDistinctManufacturers);
router.get("/wmi/manufacturers", requireAuth, getManufacturers);
export default router;
