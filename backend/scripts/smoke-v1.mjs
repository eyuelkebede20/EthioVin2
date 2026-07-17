#!/usr/bin/env node
// Post-deploy smoke test for the public /v1 API. Exercises the launch-critical
// path end-to-end against a LIVE server (the report's "interactive smoke test"
// handoff, scripted). Node 22+ (global fetch, ESM). No deps, no DB access.
//
//   BASE_URL=https://ethiovinapi.senaycreatives.com \
//   API_KEY=evn_live_xxx \
//   CACHED_VIN=LCO... \
//   node scripts/smoke-v1.mjs
//
// BASE_URL      required — the API origin (no trailing /v1).
// API_KEY       optional — a real evn_live_ key. Without it, only the keyless
//               checks run (health + 401 envelope). WITH it, the charged decode
//               runs and SPENDS 1 credit on a hit — use a throwaway/test key.
// CACHED_VIN    optional — a VIN already in the ledger/cache (expects match!=none,
//               charged:1). Get one from GET /api/v1/dev/demo. If omitted, the
//               charged-hit assertion is skipped (only the free paths run).
// UNKNOWN_VIN   optional — a well-formed 17-char VIN that is NOT in the cache.
//               Expects 200 match:"none" charged:0 (the "never charge for we-don't-
//               know" law). Default is a random-looking WMI unlikely to be cached.
// INVALID_VIN   optional — a MALFORMED VIN (not 17 clean chars). Expects HTTP 422
//               invalid_vin with the public error envelope (free, not charged).
//               Default "NOTAVALIDVIN0" (13 chars).
//
// Exit code 0 = all run checks passed, 1 = a check failed. The 402 path (empty
// balance) is NOT auto-run — it needs a zero-credit key; see the manual note printed
// at the end.

const BASE = (process.env.BASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.API_KEY || "";
const CACHED_VIN = process.env.CACHED_VIN || "";
const UNKNOWN_VIN = process.env.UNKNOWN_VIN || "ZZZ1234567ZZZ9999";
const INVALID_VIN = process.env.INVALID_VIN || "NOTAVALIDVIN0";

if (!BASE) {
  console.error("BASE_URL is required, e.g. BASE_URL=https://ethiovinapi.senaycreatives.com");
  process.exit(2);
}

let passed = 0;
let failed = 0;

function ok(name, detail = "") {
  passed++;
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function bad(name, detail = "") {
  failed++;
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(path, { method = "GET", key, body, idempotencyKey } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json };
}

function isPublicErrorEnvelope(json) {
  return json && json.error && typeof json.error.code === "string" && typeof json.error.message === "string";
}

async function main() {
  console.log(`\nSmoke test — ${BASE}\n`);

  // 1. Health (keyless, un-throttled).
  {
    const r = await req("/v1/health");
    if (r.status === 200 && r.json && r.json.status === "ok") ok("GET /v1/health", "status:ok");
    else bad("GET /v1/health", `got ${r.status} ${JSON.stringify(r.json)}`);
  }

  // 2. Keyless decode must be 401 with the PUBLIC envelope (never the internal shape).
  {
    const r = await req("/v1/decode", { method: "POST", body: { vin: INVALID_VIN } });
    if (r.status === 401 && isPublicErrorEnvelope(r.json)) ok("POST /v1/decode (no key)", "401 public envelope");
    else bad("POST /v1/decode (no key)", `expected 401 {error:{code,message}}, got ${r.status} ${JSON.stringify(r.json)}`);
  }

  if (!KEY) {
    console.log("\n(no API_KEY set — skipping charged/account checks)\n");
    return finish();
  }

  // 3. Account reachable with the key.
  let startBalance = null;
  {
    const r = await req("/v1/account", { key: KEY });
    if (r.status === 200 && r.json && typeof r.json.balance === "number") {
      startBalance = r.json.balance;
      ok("GET /v1/account", `balance:${startBalance}`);
    } else bad("GET /v1/account", `got ${r.status} ${JSON.stringify(r.json)}`);
  }

  // 4a. Malformed VIN -> 422 invalid_vin (public envelope), never charged.
  {
    const r = await req("/v1/decode", { key: KEY, method: "POST", body: { vin: INVALID_VIN } });
    if (r.status === 422 && isPublicErrorEnvelope(r.json) && r.json.error.code === "invalid_vin") ok("decode malformed VIN", "422 invalid_vin (free)");
    else bad("decode malformed VIN", `expected 422 invalid_vin, got ${r.status} ${JSON.stringify(r.json)}`);
  }

  // 4b. Well-formed but unknown VIN -> 200 match:"none", charged:0 (the "never charge
  //     for we-don't-know" law: a valid VIN we can't match is free, not an error).
  {
    const r = await req("/v1/decode", { key: KEY, method: "POST", body: { vin: UNKNOWN_VIN } });
    const charged = r.json?.credits?.charged;
    if (r.status === 200 && r.json?.match === "none" && charged === 0 && r.json?.vehicle === null) ok("decode unknown VIN", "200 match:none charged:0 (free)");
    else bad("decode unknown VIN", `expected 200 match:none charged:0, got ${r.status} match:${r.json?.match} ${JSON.stringify(r.json?.credits)}`);
  }

  // 5. Cached VIN decodes as a HIT and charges exactly 1 credit.
  if (CACHED_VIN) {
    const r = await req("/v1/decode", { key: KEY, method: "POST", body: { vin: CACHED_VIN } });
    const charged = r.json?.credits?.charged;
    const match = r.json?.match;
    if (r.status === 200 && (match === "exact" || match === "model") && charged === 1 && r.json?.vehicle) {
      ok("decode cached VIN", `match:${match} charged:1 balance:${r.json.credits.balance}`);
      // Balance decremented by exactly 1 vs the account read.
      if (startBalance != null && r.json.credits.balance === startBalance - 1) ok("balance decremented by 1", `${startBalance} → ${r.json.credits.balance}`);
      else bad("balance decremented by 1", `start ${startBalance}, after ${r.json.credits.balance}`);

      // 6. Idempotency: same key+body replays WITHOUT a second charge.
      const idem = `smoke-${CACHED_VIN}-${startBalance}`;
      const a = await req("/v1/decode", { key: KEY, method: "POST", body: { vin: CACHED_VIN }, idempotencyKey: idem });
      const b = await req("/v1/decode", { key: KEY, method: "POST", body: { vin: CACHED_VIN }, idempotencyKey: idem });
      if (a.status === 200 && b.status === 200 && a.json?.credits?.balance === b.json?.credits?.balance) ok("Idempotency-Key replay", `no second charge (balance stable at ${b.json.credits.balance})`);
      else bad("Idempotency-Key replay", `balances ${a.json?.credits?.balance} vs ${b.json?.credits?.balance}`);
    } else {
      bad("decode cached VIN", `expected hit+charged:1, got ${r.status} match:${match} ${JSON.stringify(r.json?.credits)}`);
    }
  } else {
    console.log("  – (no CACHED_VIN set — skipping the charged-hit + idempotency checks)");
  }

  // 7. Batch decode: always 200, partial results, per-VIN outcomes. Mixes an invalid VIN
  //    (free per-item error) with an unknown VIN (free match:none). Uses no cached VIN so
  //    it never charges — keeps the smoke test cheap and balance-neutral.
  {
    const r = await req("/v1/decode/batch", { key: KEY, method: "POST", body: { vins: [UNKNOWN_VIN, INVALID_VIN] } });
    const results = r.json?.results;
    const okShape =
      r.status === 200 &&
      Array.isArray(results) &&
      results.length === 2 &&
      results[0]?.match === "none" &&
      results[0]?.credits?.charged === 0 &&
      results[1]?.valid === false &&
      results[1]?.error?.code === "invalid_vin" &&
      r.json?.credits?.charged === 0;
    if (okShape) ok("POST /v1/decode/batch", `200, ${results.length} partial results, total charged:0`);
    else bad("POST /v1/decode/batch", `expected 200 with [match:none, invalid_vin] charged:0, got ${r.status} ${JSON.stringify(r.json)}`);

    // Malformed batch (empty vins) -> 422 invalid_request (whole call fails, free).
    const bad1 = await req("/v1/decode/batch", { key: KEY, method: "POST", body: { vins: [] } });
    if (bad1.status === 422 && bad1.json?.error?.code === "invalid_request") ok("batch empty vins", "422 invalid_request");
    else bad("batch empty vins", `expected 422 invalid_request, got ${bad1.status} ${JSON.stringify(bad1.json)}`);
  }

  finish();
}

function finish() {
  console.log(`\n${passed} passed, ${failed} failed`);
  console.log(
    "\nNOT auto-tested (needs a zero-balance key): the 402 insufficient_credits path.\n" +
      "Manually: drain a test key to 0 credits, decode a cached VIN, and confirm 402\n" +
      "`insufficient_credits` with NO `specs`/`vehicle` in the body (paid data withheld on a failed charge).\n",
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("\nSmoke test crashed:", e.message);
  process.exit(1);
});
