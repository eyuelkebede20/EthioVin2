import { Router } from "express";
import type { Request, Response } from "express";
import { ipFloodLimiter, invalidKeyLimiter, requireApiKey, perKeyLimiter } from "../middleware/apiKeyAuth.ts";
import { publicNotFound, publicErrorHandler } from "../middleware/publicApiError.ts";
import { decode, decodeBatch, account, usage } from "../controllers/publicApiController.ts";

// The public, keyed API surface. Mounts at /v1 (host-agnostic — the one deliberate
// exception to the /api/* rule). Its own notFound + error handler keep the public
// envelope { error: { code, message } } isolated from the internal string shape.
const router = Router();

// Unauthenticated liveness probe (mirrors /health). Registered before the key gate.
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Pipeline: ipFloodLimiter -> invalidKeyLimiter (counts 401s) -> requireApiKey -> perKeyLimiter.
router.use(ipFloodLimiter, invalidKeyLimiter, requireApiKey, perKeyLimiter);

router.post("/decode", decode);

// Batch decode — up to 50 VINs, charged per VIN, partial results (§8/§15).
router.post("/decode/batch", decodeBatch);

router.get("/account", account);
router.get("/usage", usage);

// Router-level 404 + error envelope (keep these LAST, in this order).
router.use(publicNotFound);
router.use(publicErrorHandler);

export default router;
