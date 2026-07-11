import { Router } from "express";
import { requireRole } from "../middleware/authMiddleware.ts";
import { getUnknownWMIs, updateWMI, getDistinctManufacturers, createOrg, listOrgs, getOrgDetail, addOrgMember, createAgreement, revokeAgreement, getAnalytics, listContributors, listFlags, getSettings, updateSettings } from "../controllers/adminController.ts";
import { createPromo, listPromos, updatePromo, grantCredits, updateKeyLimit } from "../controllers/adminApiController.ts";

const router = Router();

// Restrict to super_admin (no brackets — requireRole takes spread args)
router.get("/wmi/unknown", requireRole("super_admin"), getUnknownWMIs);
router.put("/wmi/update", requireRole("super_admin"), updateWMI);
router.get("/wmi/manufacturers", requireRole("super_admin"), getDistinctManufacturers);

// Org onboarding + analytics (super_admin)
router.get("/orgs", requireRole("super_admin"), listOrgs);
router.post("/orgs", requireRole("super_admin"), createOrg);
router.post("/orgs/members", requireRole("super_admin"), addOrgMember);
// :id is matched after the literal /orgs/members POST (different method) and the
// /orgs GET/POST above — Express routes by method+path so there's no shadowing.
router.get("/orgs/:id", requireRole("super_admin"), getOrgDetail);
router.post("/agreements", requireRole("super_admin"), createAgreement);
router.patch("/agreements/:id/revoke", requireRole("super_admin"), revokeAgreement);
router.get("/analytics", requireRole("super_admin"), getAnalytics);
router.get("/contributors", requireRole("super_admin"), listContributors);
router.get("/flags", requireRole("super_admin"), listFlags);
router.get("/settings", requireRole("super_admin"), getSettings);
router.patch("/settings", requireRole("super_admin"), updateSettings);

// M3 — API platform admin (promo CRUD, manual credit grants, key-limit overrides).
router.post("/promo", requireRole("super_admin"), createPromo);
router.get("/promo", requireRole("super_admin"), listPromos);
router.patch("/promo/:id", requireRole("super_admin"), updatePromo);
router.post("/credits/grant", requireRole("super_admin"), grantCredits);
router.patch("/api-keys/:id/limit", requireRole("super_admin"), updateKeyLimit);

export default router;
