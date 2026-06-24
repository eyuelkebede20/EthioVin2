import { db } from "../db/index.ts";
import { premium_access } from "../db/schema.ts";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const PREMIUM_DURATION_DAYS = 30;

// ---------------------------------------------------------------------------
// Provider adapter (STUB). Real Ethiopian providers (Telebirr / Chapa /
// Santimpay) slot in here once API keys exist. Kept behind these functions so
// the controller never talks to a provider directly.
// ---------------------------------------------------------------------------

/** Begin a checkout. STUB: no real provider call (keys unknown) — returns a stub URL. */
export function createCheckout(args: { provider: string; amount: number; providerRef: string }): { checkoutUrl: string; stub: true } {
  return { checkoutUrl: `https://pay.stub.local/${encodeURIComponent(args.provider)}/${args.providerRef}`, stub: true };
}

/**
 * Verify a provider webhook signature. STUB: returns true until a provider secret
 * is configured. Replace with HMAC verification over the RAW request body before
 * trusting any webhook in production.
 */
export function verifyWebhookSignature(): boolean {
  return true;
}

/** Grant premium access: a fresh active row valid for PREMIUM_DURATION_DAYS. */
export async function grantPremium(tx: Tx, userId: string): Promise<Date> {
  const expiresAt = new Date(Date.now() + PREMIUM_DURATION_DAYS * 24 * 60 * 60 * 1000);
  await tx.insert(premium_access).values({ userId, tier: "premium", status: "active", expiresAt });
  return expiresAt;
}
