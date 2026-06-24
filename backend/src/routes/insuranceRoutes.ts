import { Router } from "express";
import { postClaim, postPoliceReport, getVehicleView } from "../controllers/insuranceController.ts";

// Gated by requireOrg("insurer") at the mount (index.ts). Each handler also
// requires an active data-sharing agreement and scopes writes by req.org.id.
const router = Router();

router.post("/claims", postClaim);
router.post("/police-reports", postPoliceReport);
router.get("/vehicles/:vin", getVehicleView);

export default router;
