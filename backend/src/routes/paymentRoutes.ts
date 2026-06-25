import { Router } from "express";
import { initPayment, handleWebhook, listMyPayments, getPaymentConfig, getMyEntitlement } from "../controllers/paymentController.ts";
import { requireAuth } from "../middleware/authMiddleware.ts";

const router = Router();

router.get("/config", requireAuth, getPaymentConfig);
router.post("/init", requireAuth, initPayment);
// PUBLIC — the provider posts here. Idempotent; no session (signature-gated).
router.post("/webhook", handleWebhook);
router.get("/me", requireAuth, listMyPayments);
router.get("/me/entitlement", requireAuth, getMyEntitlement);

export default router;
