import { Router } from "express";
import { initPayment, handleWebhook, listMyPayments } from "../controllers/paymentController.ts";
import { requireAuth } from "../middleware/authMiddleware.ts";

const router = Router();

router.post("/init", requireAuth, initPayment);
// PUBLIC — the provider posts here. Idempotent; no session (signature-gated).
router.post("/webhook", handleWebhook);
router.get("/me", requireAuth, listMyPayments);

export default router;
