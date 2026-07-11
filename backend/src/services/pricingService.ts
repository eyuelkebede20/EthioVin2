import { getSetting, setSetting } from "./settingsService.ts";
import { DEFAULT_PRICING, type PricingConfig, type CreditPack } from "../lib/pricing.ts";

// Runtime-editable pricing. The source of truth is app_settings["pricing"]; when it's
// absent (fresh DB) we fall back to DEFAULT_PRICING in lib/pricing.ts. A super_admin
// edits it via /api/v1/admin/pricing — no code change or redeploy needed.

const PRICING_KEY = "pricing";

export async function getPricingConfig(): Promise<PricingConfig> {
  const cfg = await getSetting<Partial<PricingConfig> | null>(PRICING_KEY, null);
  if (!cfg || !Array.isArray(cfg.packs) || cfg.packs.length === 0) return DEFAULT_PRICING;
  return {
    packs: cfg.packs as CreditPack[],
    signupGrantCredits: typeof cfg.signupGrantCredits === "number" ? cfg.signupGrantCredits : DEFAULT_PRICING.signupGrantCredits,
  };
}

export async function setPricingConfig(cfg: PricingConfig): Promise<void> {
  await setSetting(PRICING_KEY, cfg);
}

export async function getPackById(packId: string): Promise<CreditPack | undefined> {
  return (await getPricingConfig()).packs.find((p) => p.packId === packId);
}

export async function getSignupGrantCredits(): Promise<number> {
  return (await getPricingConfig()).signupGrantCredits;
}
