import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { generateRawKey, sha256hex, resolveApiKey, LIVE_PREFIX, TEST_PREFIX } from "../src/services/apiKeyService.ts";
import { verifyWebhookSignature } from "../src/services/chapaService.ts";
import { generatePromoCode } from "../src/services/promoService.ts";
import { getPack, CREDIT_PACKS, SIGNUP_GRANT_CREDITS } from "../src/lib/pricing.ts";
import { newRequestId, nano } from "../src/utils/id.ts";
import { parseVin } from "../src/utils/vin.ts";
import { publicDecodeBatchSchema, BATCH_DECODE_MAX } from "../src/utils/validation.ts";

// These are pure-logic tests — they never hit the database. (Importing the modules
// is safe: db/index.ts constructs a LAZY postgres client and only connects on query.)

// --- API keys (failure registry #6: key brute force) -------------------------
test("generateRawKey: evn_live_ format + correct derivations", () => {
  const { raw, keyHash, keyPrefix, last4 } = generateRawKey();
  assert.ok(raw.startsWith(LIVE_PREFIX), "raw uses the live prefix");
  assert.equal(raw.length, LIVE_PREFIX.length + 43, "43 base62 chars after the prefix");
  assert.equal(keyHash, sha256hex(raw), "hash is sha256 of the raw key");
  assert.equal(keyHash.length, 64, "sha256 hex is 64 chars");
  assert.equal(keyPrefix, raw.slice(0, 13));
  assert.equal(last4, raw.slice(-4));
  assert.notEqual(raw, generateRawKey().raw, "keys are unique");
});

test("resolveApiKey rejects the reserved evn_test_ prefix and empty input (no DB)", async () => {
  assert.equal(await resolveApiKey(""), null);
  assert.equal(await resolveApiKey(TEST_PREFIX + "anything"), null);
});

// --- Chapa webhook signature (failure registry #2: replay/spoof) -------------
test("verifyWebhookSignature: valid HMAC passes, tampered/missing fail", () => {
  const secret = "whsec_unit_test";
  process.env.CHAPA_WEBHOOK_SECRET = secret;
  const body = Buffer.from(JSON.stringify({ tx_ref: "evnp_1", status: "success" }));

  const bodyHmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const secretHmac = crypto.createHmac("sha256", secret).update(secret).digest("hex");

  assert.equal(verifyWebhookSignature(body, bodyHmac), true, "payload HMAC accepted");
  assert.equal(verifyWebhookSignature(body, secretHmac), true, "secret HMAC accepted");
  assert.equal(verifyWebhookSignature(body, "deadbeef"), false, "wrong signature rejected");
  assert.equal(verifyWebhookSignature(body, undefined), false, "missing signature rejected");

  delete process.env.CHAPA_WEBHOOK_SECRET;
  assert.equal(verifyWebhookSignature(body, bodyHmac), false, "no secret configured -> reject");
});

// --- Promo codes (failure registry #11: enumeration) -------------------------
test("generatePromoCode excludes ambiguous chars (0/O/1/I) and honors length", () => {
  for (let i = 0; i < 100; i++) {
    const code = generatePromoCode(12);
    assert.equal(code.length, 12);
    assert.ok(!/[01OI]/.test(code), `no ambiguous chars in ${code}`);
  }
});

// --- Pricing (single source) -------------------------------------------------
test("pricing: packs resolvable, signup grant positive", () => {
  assert.ok(CREDIT_PACKS.length >= 1);
  assert.ok(getPack(CREDIT_PACKS[0]!.packId));
  assert.equal(getPack("does_not_exist"), undefined);
  assert.ok(SIGNUP_GRANT_CREDITS > 0);
});

// --- Ids ---------------------------------------------------------------------
test("request id + nano format", () => {
  assert.match(newRequestId(), /^req_[0-9A-Za-z]{20}$/);
  assert.equal(nano(10).length, 10);
  assert.notEqual(nano(), nano());
});

// --- VIN parsing (invalid VIN -> rejected; I/O/Q preserved) ------------------
test("parseVin: rejects non-17, keeps I/O/Q, correct slices", () => {
  assert.throws(() => parseVin("TOOSHORT"), /17 characters/);
  assert.throws(() => parseVin(123 as unknown as string));
  const p = parseVin("LCOCE4CBS12345678"); // 17 chars, contains O
  assert.equal(p.keyVin.length, 17);
  assert.equal(p.wmi, "LCO");
  assert.equal(p.vds_code, "CE4CB");
  assert.ok(p.keyVin.includes("O"), "O is preserved (ASEAN VIN)");
});

// --- Batch decode body validation (1..50 VINs) -------------------------------
test("publicDecodeBatchSchema: accepts 1..50, rejects empty/oversized/non-array", () => {
  assert.equal(BATCH_DECODE_MAX, 50);
  // Valid: one VIN, and exactly the max.
  assert.ok(publicDecodeBatchSchema.safeParse({ vins: ["LCOCE4CBS12345678"] }).success);
  assert.ok(publicDecodeBatchSchema.safeParse({ vins: Array(BATCH_DECODE_MAX).fill("LCOCE4CBS12345678") }).success);
  // Invalid: empty array, over the cap, missing field, wrong type, empty string element.
  assert.equal(publicDecodeBatchSchema.safeParse({ vins: [] }).success, false);
  assert.equal(publicDecodeBatchSchema.safeParse({ vins: Array(BATCH_DECODE_MAX + 1).fill("x") }).success, false);
  assert.equal(publicDecodeBatchSchema.safeParse({}).success, false);
  assert.equal(publicDecodeBatchSchema.safeParse({ vins: "LCOCE4CBS12345678" }).success, false);
  assert.equal(publicDecodeBatchSchema.safeParse({ vins: [""] }).success, false);
});
