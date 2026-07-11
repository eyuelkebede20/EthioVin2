import "dotenv/config";
import { lt } from "drizzle-orm";
import { db } from "./index.ts";
import { apiRequestLog, apiIdempotency } from "./schema.ts";

// Prune old public-API bookkeeping rows. api_request_log is the billing-dispute
// record and api_idempotency the retry cache — both are safe to drop after the
// retention window. Wire to a cPanel cron: `npm run logs:prune`.

const RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS ?? 180);

async function main() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const logs = await db.delete(apiRequestLog).where(lt(apiRequestLog.createdAt, cutoff)).returning({ id: apiRequestLog.id });
  const idem = await db.delete(apiIdempotency).where(lt(apiIdempotency.createdAt, cutoff)).returning({ id: apiIdempotency.id });
  console.log(`[${new Date().toISOString()}] logs:prune — removed ${logs.length} api_request_log + ${idem.length} api_idempotency rows older than ${RETENTION_DAYS}d`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[logs:prune] failed:", err);
  process.exit(1);
});
