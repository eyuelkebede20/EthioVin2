import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { app_settings } from "../db/schema.ts";

// Known setting keys. Defaults apply when the row is absent (so a fresh DB just
// works — payments are ON by default; a super_admin can toggle them off).
export const SETTING_KEYS = {
  paymentsEnabled: "payments_enabled",
} as const;

export const SETTING_DEFAULTS = {
  paymentsEnabled: true,
} as const;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select({ value: app_settings.value }).from(app_settings).where(eq(app_settings.key, key)).limit(1);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.insert(app_settings).values({ key, value }).onConflictDoUpdate({ target: app_settings.key, set: { value, updated_at: new Date() } });
}

/** Convenience: the public-facing flag the payment routes and admin both use. */
export function getPaymentsEnabled(): Promise<boolean> {
  return getSetting<boolean>(SETTING_KEYS.paymentsEnabled, SETTING_DEFAULTS.paymentsEnabled);
}
