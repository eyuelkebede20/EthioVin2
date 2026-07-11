import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { apiKey } from "../db/schema.ts";

// API keys are `evn_live_<43 base62 chars>` from 32 random bytes (256-bit entropy).
// `evn_test_` is RESERVED for a future sandbox mode — never generated, rejected on
// auth so nothing squats on it. Only the SHA-256 hex of the full key is stored;
// the raw key is shown exactly once at creation and is unrecoverable.

export const LIVE_PREFIX = "evn_live_";
export const TEST_PREFIX = "evn_test_";
const KEY_BYTES = 32;
const KEY_CHARS = 43; // ceil(256 / log2(62))
const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export type ApiKeyRecord = typeof apiKey.$inferSelect;

/** SHA-256 hex — the lookup transform for a presented key. */
export function sha256hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function base62(buf: Buffer, length: number): string {
  let num = BigInt("0x" + buf.toString("hex"));
  let out = "";
  while (num > 0n) {
    out = B62[Number(num % 62n)] + out;
    num /= 62n;
  }
  return out.padStart(length, "0").slice(-length);
}

/** Mint a raw key + its stored derivatives. The raw value never touches the DB. */
export function generateRawKey(): { raw: string; keyHash: string; keyPrefix: string; last4: string } {
  const raw = LIVE_PREFIX + base62(crypto.randomBytes(KEY_BYTES), KEY_CHARS);
  return {
    raw,
    keyHash: sha256hex(raw),
    keyPrefix: raw.slice(0, 13), // e.g. "evn_live_9f3K" — display only
    last4: raw.slice(-4),
  };
}

/** Insert a new active key for an owner. Returns the raw key ONCE plus the record. */
export async function createApiKey(args: { ownerId: string; name: string; rateLimitPerMin: number }): Promise<{ raw: string; record: ApiKeyRecord }> {
  const { raw, keyHash, keyPrefix, last4 } = generateRawKey();
  const [record] = await db
    .insert(apiKey)
    .values({ ownerId: args.ownerId, name: args.name, keyPrefix, keyHash, last4, rateLimitPerMin: args.rateLimitPerMin })
    .returning();
  if (!record) throw new Error("Failed to create API key");
  return { raw, record };
}

/** Resolve a presented raw key to an ACTIVE, unexpired record, or null. */
export async function resolveApiKey(raw: string): Promise<ApiKeyRecord | null> {
  if (!raw || typeof raw !== "string" || raw.startsWith(TEST_PREFIX)) return null;
  const [key] = await db.select().from(apiKey).where(eq(apiKey.keyHash, sha256hex(raw))).limit(1);
  if (!key || key.status !== "active") return null;
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) return null;
  return key;
}

/** List an owner's keys (never the hash). */
export async function listApiKeys(ownerId: string): Promise<ApiKeyRecord[]> {
  return db.select().from(apiKey).where(eq(apiKey.ownerId, ownerId));
}

/** Revoke a key (status flip + revokedAt). Rows are never deleted — logs FK them. */
export async function revokeApiKey(id: string): Promise<void> {
  await db.update(apiKey).set({ status: "revoked", revokedAt: new Date() }).where(eq(apiKey.id, id));
}

const TOUCH_STALENESS_MS = 60_000;

/** Fire-and-forget lastUsedAt bump, only if >60s stale (don't write per request). */
export function touchLastUsed(key: ApiKeyRecord): void {
  if (key.lastUsedAt && Date.now() - key.lastUsedAt.getTime() < TOUCH_STALENESS_MS) return;
  void db
    .update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.id, key.id))
    .catch((err) => console.error("[apiKey] touchLastUsed failed:", err));
}
