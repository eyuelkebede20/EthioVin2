import { Router } from "express";
import { requireRole } from "../middleware/authMiddleware.ts";
import { getUnknownWMIs, updateWMI, getDistinctManufacturers, createOrg, addOrgMember, createAgreement, revokeAgreement, getAnalytics } from "../controllers/adminController.ts";

const router = Router();

// Restrict to super_admin (no brackets — requireRole takes spread args)
router.get("/wmi/unknown", requireRole("super_admin"), getUnknownWMIs);
router.put("/wmi/update", requireRole("super_admin"), updateWMI);
router.get("/wmi/manufacturers", requireRole("super_admin"), getDistinctManufacturers);

// Org onboarding + analytics (super_admin)
router.post("/orgs", requireRole("super_admin"), createOrg);
router.post("/orgs/members", requireRole("super_admin"), addOrgMember);
router.post("/agreements", requireRole("super_admin"), createAgreement);
router.patch("/agreements/:id/revoke", requireRole("super_admin"), revokeAgreement);
router.get("/analytics", requireRole("super_admin"), getAnalytics);

export default router;
