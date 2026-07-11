import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { promoCode, promoRedemption } from "../db/schema.ts";
import { AppError } from "../middleware/errorHandler.ts";
import * as creditBridge from "../services/creditBridge.ts";
import { nano } from "../utils/id.ts";

// Distinct redemption errors (surfaced to the portal) — 409 so they're not confused
// with validation 400s.
export class PromoError extends AppError {
  code: string;
  constructor(code: string, message: string) {
    super(409, message);
    this.name = "PromoError";
    this.code = code;
  }
}

// Generated codes exclude ambiguous chars (0/O/1/I) so they can't be mis-typed.
const UNAMBIGUOUS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function generatePromoCode(length = 10): string {
  let out = "";
  const raw = nano(length * 2);
  for (const ch of raw) {
    const idx = ch.charCodeAt(0) % UNAMBIGUOUS.length;
    out += UNAMBIGUOUS[idx];
    if (out.length === length) break;
  }
  return out;
}

/**
 * Redeem a promo code for the owner. Transactional: locks the promo row, validates
 * window/status/limits, inserts the redemption (the unique (promoCodeId, ownerId) is
 * the real race guard), bumps the count, and grants credits in the SAME transaction.
 */
export async function redeemPromo(ownerId: string, code: string): Promise<{ credited: number; balance: number; code: string }> {
  const normalized = code.trim().toUpperCase();

  return db.transaction(async (tx) => {
    const [promo] = await tx.select().from(promoCode).where(eq(promoCode.code, normalized)).for("update").limit(1);
    if (!promo) throw new PromoError("promo_invalid", "That promo code is not valid.");
    if (promo.status !== "active") throw new PromoError("promo_invalid", "That promo code is not active.");

    const now = new Date();
    if (promo.startsAt && promo.startsAt.getTime() > now.getTime()) throw new PromoError("promo_invalid", "That promo code is not active yet.");
    if (promo.expiresAt && promo.expiresAt.getTime() < now.getTime()) throw new PromoError("promo_expired", "That promo code has expired.");
    if (promo.maxRedemptions != null && promo.redeemedCount >= promo.maxRedemptions) {
      throw new PromoError("promo_exhausted", "That promo code has been fully redeemed.");
    }

    // Per-account limit (perAccountLimit defaults to 1). The unique constraint below
    // enforces the count===1 case; this covers >1 explicitly.
    const [used] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(promoRedemption)
      .where(and(eq(promoRedemption.promoCodeId, promo.id), eq(promoRedemption.ownerId, ownerId)));
    if ((used?.n ?? 0) >= promo.perAccountLimit) throw new PromoError("promo_already_redeemed", "You have already redeemed this code.");

    try {
      await tx.insert(promoRedemption).values({ promoCodeId: promo.id, ownerId, credited: promo.credits });
    } catch (err) {
      // Unique (promoCodeId, ownerId) violation => concurrent/duplicate redeem.
      if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
        throw new PromoError("promo_already_redeemed", "You have already redeemed this code.");
      }
      throw err;
    }

    await tx.update(promoCode).set({ redeemedCount: sql`${promoCode.redeemedCount} + 1` }).where(eq(promoCode.id, promo.id));

    const { balance } = await creditBridge.grant(
      { ownerId, amount: promo.credits, source: "promo", ref: `promo:${promo.id}:${ownerId}` },
      tx,
    );

    return { credited: promo.credits, balance, code: normalized };
  });
}
