import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { credit_ledger } from "../db/schema.ts";
import { AppError } from "../middleware/errorHandler.ts";

// A transaction handle (the arg drizzle hands the db.transaction callback).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Redemption model is deferred (plan decision 2026-06-23): the ledger records
// earn AND spend events now, but what credits redeem FOR stays gated by this flag
// until after phase 3. "neutral" = earn-only economy, no real-world redemption.
export const CREDIT_REDEMPTION_MODE = (process.env.CREDIT_REDEMPTION_MODE ?? "neutral") as "neutral" | "closed_loop" | "cash_out" | "status";

export type CreditReason = "data_input" | "verification" | "referral" | "redemption" | "penalty" | "exchange";

/**
 * recordCredit — append ONE ledger row with an updated running balance.
 *
 * MUST be called inside a `db.transaction`. Takes a per-user Postgres advisory
 * lock so concurrent awards can't read the same prior balance and corrupt it —
 * this also covers the empty-ledger race (no row to lock yet). Positive delta =
 * earn, negative = spend. The balance is a running column, never a SUM() of the
 * whole ledger.
 */
export async function recordCredit(tx: Tx, args: { userId: string; delta: number; reason: CreditReason; eventId?: string | null }): Promise<{ balanceAfter: number }> {
  const { userId, delta, reason, eventId = null } = args;

  // Serialize all credit math for this user for the life of the transaction.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId})::bigint)`);

  const [last] = await tx
    .select({ balanceAfter: credit_ledger.balanceAfter })
    .from(credit_ledger)
    .where(eq(credit_ledger.userId, userId))
    .orderBy(sql`${credit_ledger.createdAt} desc`, sql`${credit_ledger.id} desc`)
    .limit(1);

  const prev = last ? Number(last.balanceAfter) : 0;
  const next = prev + delta;
  if (next < 0) throw new AppError(400, "Insufficient credit balance");

  await tx.insert(credit_ledger).values({
    userId,
    delta: String(delta),
    reason,
    eventId,
    balanceAfter: String(next),
  });

  return { balanceAfter: next };
}

/** Current balance = the latest ledger row's running balance (0 if none). */
export async function getCreditBalance(userId: string): Promise<number> {
  const [last] = await db
    .select({ balanceAfter: credit_ledger.balanceAfter })
    .from(credit_ledger)
    .where(eq(credit_ledger.userId, userId))
    .orderBy(sql`${credit_ledger.createdAt} desc`, sql`${credit_ledger.id} desc`)
    .limit(1);
  return last ? Number(last.balanceAfter) : 0;
}
