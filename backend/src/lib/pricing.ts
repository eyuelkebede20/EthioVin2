// The ONE place credit amounts + pack prices live. The portal/landing fetch these
// via GET /api/v1/dev/billing/packs — never hardcode prices in web/. All numbers are
// PLACEHOLDERS pending pricing sign-off (claude.milestone3.md §1, open input #2).

/** Free evaluation grant, issued once per account on first API-key creation. */
export const SIGNUP_GRANT_CREDITS = 25;

/** Rate-limit tiers (req/min per key). */
export const FREE_RATE_LIMIT_PER_MIN = 10;
export const PAID_RATE_LIMIT_PER_MIN = 60;

export interface CreditPack {
  packId: string;
  credits: number;
  /** Price in ETB. PLACEHOLDER — confirm before launch. */
  priceEtb: number;
  note: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { packId: "starter", credits: 200, priceEtb: 250, note: "Entry" },
  { packId: "growth", credits: 1000, priceEtb: 1000, note: "~15% bonus credits" },
  { packId: "scale", credits: 5000, priceEtb: 4500, note: "~30% bonus credits" },
];

export function getPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.packId === packId);
}

// The editable pricing shape. The DEFAULTS below are the fallback when a super_admin
// hasn't overridden pricing in app_settings (see services/pricingService.ts) — so a
// fresh DB just works, and prices/grant are adjustable at runtime with no code change.
export interface PricingConfig {
  packs: CreditPack[];
  signupGrantCredits: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  packs: CREDIT_PACKS,
  signupGrantCredits: SIGNUP_GRANT_CREDITS,
};
