import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { ipFloodLimiter, invalidKeyLimiter, requireApiKey, perKeyLimiter } from "../middleware/apiKeyAuth.ts";
import { publicNotFound, publicErrorHandler, PublicApiError } from "../middleware/publicApiError.ts";
import { decode, account, usage } from "../controllers/publicApiController.ts";

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

// Reserved — batch decode ships as a 501 stub with a frozen contract (§8/§15).
router.post("/decode/batch", (_req: Request, _res: Response, next: NextFunction) => {
  next(new PublicApiError(501, "not_implemented", "Batch decode is reserved and not available in v1."));
});

router.get("/account", account);
router.get("/usage", usage);

// Router-level 404 + error envelope (keep these LAST, in this order).
router.use(publicNotFound);
router.use(publicErrorHandler);

export default router;
