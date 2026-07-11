import { and, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { credit_ledger } from "../db/schema.ts";
import { recordCredit, getCreditBalance, type CreditReason } from "./creditService.ts";
import { AppError } from "../middleware/errorHandler.ts";

// The ONE bridge between M3 (public API + billing) and M2's single credit ledger.
// Every M3 module imports only this — never credit_ledger directly. There is ONE
// balance per account (keyed by user.id); we do NOT fork a second wallet store.
//
// M2's ledger uses a fixed CreditReason enum with no purchase/promo/api values, so
// the true source is preserved in the ledger's eventId (= the unique `ref`), and the
// enum reason is mapped: an API spend is a "redemption", money/promo/grant inflows
// are "exchange". Nothing branches on the reason label in recordCredit.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ChargeSource = "api_decode";
export type GrantSource = "purchase" | "promo" | "signup_grant" | "admin_grant";

const CHARGE_REASON: CreditReason = "redemption";
const GRANT_REASON: CreditReason = "exchange";

/** Thrown when a charge would drive the balance negative. The /v1 layer maps this to 402. */
export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credit balance");
    this.name = "InsufficientCreditsError";
  }
}

function runInTx<T>(tx: Tx | undefined, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return tx ? fn(tx) : db.transaction(fn);
}

/**
 * charge — a guarded, serialized decrement (recordCredit takes a per-user advisory
 * xact lock and throws if the balance would go negative). Two concurrent charges on a
 * 1-credit balance can never both succeed. Insufficient balance -> InsufficientCreditsError.
 */
export async function charge(opts: { ownerId: string; amount: number; source: ChargeSource; ref: string }, tx?: Tx): Promise<{ balance: number }> {
  try {
    const { balanceAfter } = await runInTx(tx, (t) =>
      recordCredit(t, { userId: opts.ownerId, delta: -Math.abs(opts.amount), reason: CHARGE_REASON, eventId: opts.ref }),
    );
    return { balance: balanceAfter };
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400 && /insufficient/i.test(err.message)) {
      throw new InsufficientCreditsError();
    }
    throw err;
  }
}

/**
 * grant — credit an account. Pass the caller's `tx` to keep the grant atomic with its
 * guard row (credit_purchase / promo_redemption whose unique constraint is the replay
 * guard). Without a guard row, the caller is responsible for idempotency (see hasGrantRef).
 */
export async function grant(opts: { ownerId: string; amount: number; source: GrantSource; ref: string }, tx?: Tx): Promise<{ balance: number }> {
  const { balanceAfter } = await runInTx(tx, (t) =>
    recordCredit(t, { userId: opts.ownerId, delta: Math.abs(opts.amount), reason: GRANT_REASON, eventId: opts.ref }),
  );
  return { balance: balanceAfter };
}

/** True if a ledger row with this exact ref already exists — the idempotency guard for
 *  grants that have no other unique row (e.g. the one-time signup grant, ref "signup:<owner>"). */
export async function hasGrantRef(ownerId: string, ref: string, tx?: Tx): Promise<boolean> {
  const runner = tx ?? db;
  const [row] = await runner
    .select({ id: credit_ledger.id })
    .from(credit_ledger)
    .where(and(eq(credit_ledger.userId, ownerId), eq(credit_ledger.eventId, ref)))
    .limit(1);
  return !!row;
}

/** Current balance for an account (one shared balance). */
export function balance(ownerId: string): Promise<number> {
  return getCreditBalance(ownerId);
}
