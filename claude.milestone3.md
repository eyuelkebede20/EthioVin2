# claude.milestone3.md — Milestone 3: the EthioVin API platform (branch `milestone-3`)

M3 packages the decoder as a standalone, sellable developer product: **keyed programmatic
access to VIN decoding, metered by prepaid credits**, purchasable with real money (Chapa, ETB)
or promo codes, fronted by its own landing page and a developer dashboard. Everything is
additive to M1/M2 — same Express backend, same Postgres, same `web/` Next.js app. **No new
package is added to the monorepo.**

Read `CLAUDE.md` first (VIN parsing and the cache model are unchanged and authoritative here).
Read `claude.milestone2.md` before building — M3 consumes M2's `decodeService` and credit
ledger; the boundary contracts are in §2.

The externally-published contract lives in **`API_REFERENCE.md`** (repo root). That file is the
single source of truth for the `/v1` surface — the portal docs page renders it, and this file
only summarizes it. If the contract changes, change `API_REFERENCE.md` first.

---

## 0. Scope

**In scope (v1 launch):**

- Public keyed API: `POST /v1/decode`, `GET /v1/account`, `GET /v1/usage`, `GET /v1/health`.
- API key issuance/revocation (hashed at rest, shown once).
- Prepaid credit metering wired into the M2 ledger (one balance per account — see §2).
- Per-key rate limiting + abuse backstops.
- Chapa checkout for credit packs + signature-verified, idempotent webhook crediting.
- Promo codes (create/redeem) + admin manual credit grants.
- Usage logging + per-day usage aggregation.
- `web/` additions: `/developers` landing page, `/dashboard/api` (keys/usage/billing),
  `/developers/docs` rendered from `API_REFERENCE.md`.

**Out of scope (backlog, see §15):** recurring subscriptions, test-mode keys (`evn_test_`
prefix is *reserved*, not implemented), per-key IP allowlists, OpenAPI/generated SDKs, Redis
rate-limit store, tax receipts/invoices, monthly free-credit refresh. (Batch decode
`POST /v1/decode/batch` is now **implemented** — see §8.)

---

## 1. Product model (business rules)

- The unit of the product is the **credit**. Marketing copy may say "token"; code, schema, and
  API responses always say `credits`. Do not introduce a second term in code.
- **1 credit = one decode that returns data** — a response with `match: "exact"` or
  `match: "model"`.
- **Parse-only results are free** (`match: "none"`: valid VIN, unknown model — caller gets
  WMI/year/country structure but no specs). Invalid VINs are free (`422`). This is a deliberate
  trust rule: we never charge for "we don't know", and tests must assert it (§13).
- **Prepaid only.** No negative balances, no post-pay. Insufficient balance →
  `402 insufficient_credits` (never `429` — that's reserved for rate limiting).
- **Free evaluation grant: 25 credits** (default — now runtime-editable), once per account, issued
  on **first API-key creation** (not on signup — most signups are M2 end-users, not developers).
  Ledger ref `signup:<ownerId>`; the unique ref makes the grant idempotent and un-farmable per
  account.
- **Pricing is runtime-editable — not a code constant.** The pack list + signup-grant size are
  stored in `app_settings["pricing"]` and read through `services/pricingService.ts`
  (`getPricingConfig`/`getPackById`/`getSignupGrantCredits`). `backend/src/lib/pricing.ts` holds
  only `DEFAULT_PRICING` (the fallback used when a fresh DB has no override) plus the shared
  `CreditPack`/`PricingConfig` types + rate-limit tiers. A super_admin edits prices live via
  `GET`/`PATCH /api/v1/admin/pricing` (the `/admin/credits` UI) — no redeploy. The portal/landing
  still fetch the live table via `GET /api/v1/dev/billing/packs`; **never hardcode prices in `web/`**.
- **Default credit packs** (the `DEFAULT_PRICING` fallback — a super_admin can override any of
  these at runtime):

  | pack_id   | credits | price (ETB) | note              |
  |-----------|---------|-------------|-------------------|
  | `starter` | 200     | 250         | entry             |
  | `growth`  | 1,000   | 1,000       | ~15% bonus credits|
  | `scale`   | 5,000   | 4,500       | ~30% bonus credits|

- **Rate-limit tiers:** free keys default **10 req/min**; after the account's first successful
  purchase, all its active keys move to **60 req/min** and new keys default to 60; enterprise =
  manual per-key override (admin endpoint, §9). RPM is a smoothing control — **credits are the
  real volume control.**
- **One shared balance per account** across the M2 web product and the M3 API. Do NOT fork a
  second wallet store (that's exactly the "two unlinked spec stores" mistake in the CLAUDE.md
  cleanup backlog — don't repeat it with money).

---

## 2. Boundary contracts with M1/M2

- **VIN parsing:** `parseVin()` + `decodeVinYear()` per `CLAUDE.md`, no exceptions. The public
  API inherits every convention: wmi/vds derived on the server, I/O/Q preserved (ASEAN
  imports), year treated as a heuristic. The public envelope must carry the year caveat
  (`API_REFERENCE.md` documents it for external devs).
- **Decoding:** reuse M2's `services/decodeService` outcome and map it to the public envelope
  in `publicApiController`. **Never leak the internal `/scan` shapes** (`hit`/`patientExists`/
  `promptAdmin`) into `/v1` — the public contract is flat, stable, and versioned.
- **Credits:** M3 talks to M2's credit ledger through ONE bridge module,
  `services/creditBridge.ts`, exposing exactly:

  ```ts
  charge(opts: { ownerId: string; amount: number; source: "api_decode"; ref: string }): Promise<{ balance: number }>
  grant(opts:  { ownerId: string; amount: number; source: "purchase" | "promo" | "signup_grant" | "admin_grant"; ref: string }): Promise<{ balance: number }>
  balance(ownerId: string): Promise<number>
  ```

  `ref` is unique per logical event (idempotency at the ledger). If M2's credit service
  signatures differ, **adapt inside the bridge** — every other M3 module imports only the
  bridge. ⚠️ Contingency: if the M2 ledger turns out to be scoped incompatibly (e.g. org-only
  wallets via `requireOrg`), STOP and surface it — do not silently create an `api_wallet`
  table. Decide owner scoping (user vs org) at T3 before anything charges.
- **Payments:** if M2's `paymentService` already wraps Chapa, extend it; otherwise
  `services/chapaService.ts` per §7 is the reference design. Either way the webhook/verify
  rules in §7 are mandatory.
- **Audit:** admin promo/grant endpoints run through M2's `audit` middleware.

---

## 3. Schema (additive; `db/m3.sql` is the idempotent bootstrap, same pattern as `m2.sql`)

Six new tables, zero changes to existing ones. better-auth ids are **text** — every owner FK is
`text` → `user.id`. After editing `schema.ts`: `db:generate` + `db:push` (dev); prod via
`psql "$DATABASE_URL" -f src/db/m3.sql` (guarded enums, `CREATE TABLE/INDEX IF NOT EXISTS`,
guarded FKs — mirror `m2.sql` exactly).

```ts
export const apiKeyStatusEnum = pgEnum("api_key_status", ["active", "revoked"]);
export const apiRequestResultEnum = pgEnum("api_request_result",
  ["exact", "model", "parse_only", "invalid", "error"]);
export const promoStatusEnum = pgEnum("promo_status", ["active", "disabled"]);
export const purchaseStatusEnum = pgEnum("purchase_status", ["pending", "paid", "failed"]);

export const apiKey = pgTable("api_key", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id),
  name: varchar("name", { length: 64 }).notNull(),
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),   // display only, e.g. "evn_live_9f3K"
  keyHash: varchar("key_hash", { length: 64 }).notNull().unique(), // sha256 hex — the lookup column
  last4: varchar("last4", { length: 4 }).notNull(),
  rateLimitPerMin: integer("rate_limit_per_min").notNull().default(10),
  status: apiKeyStatusEnum("status").notNull().default("active"),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

export const apiRequestLog = pgTable("api_request_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  requestId: varchar("request_id", { length: 24 }).notNull(),   // "req_" + nanoid, echoed to caller
  apiKeyId: uuid("api_key_id").notNull().references(() => apiKey.id),
  endpoint: varchar("endpoint", { length: 64 }).notNull(),
  vin: varchar("vin", { length: 17 }),
  result: apiRequestResultEnum("result").notNull(),
  creditsCharged: integer("credits_charged").notNull().default(0),
  httpStatus: integer("http_status").notNull(),
  latencyMs: integer("latency_ms"),
  ip: varchar("ip", { length: 45 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("idx_api_log_key_time").on(t.apiKeyId, t.createdAt)]);

export const apiIdempotency = pgTable("api_idempotency", {
  id: uuid("id").defaultRandom().primaryKey(),
  apiKeyId: uuid("api_key_id").notNull().references(() => apiKey.id),
  idemKey: varchar("idem_key", { length: 64 }).notNull(),
  requestHash: varchar("request_hash", { length: 64 }).notNull(), // sha256 of canonical body
  httpStatus: integer("http_status").notNull(),
  response: jsonb("response").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique("uq_idem_key").on(t.apiKeyId, t.idemKey)]);

export const promoCode = pgTable("promo_code", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),     // stored UPPERCASE
  credits: integer("credits").notNull(),
  maxRedemptions: integer("max_redemptions"),                    // null = unlimited
  redeemedCount: integer("redeemed_count").notNull().default(0),
  perAccountLimit: integer("per_account_limit").notNull().default(1),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  status: promoStatusEnum("status").notNull().default("active"),
  createdBy: text("created_by").references(() => user.id),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const promoRedemption = pgTable("promo_redemption", {
  id: uuid("id").defaultRandom().primaryKey(),
  promoCodeId: uuid("promo_code_id").notNull().references(() => promoCode.id),
  ownerId: text("owner_id").notNull().references(() => user.id),
  credited: integer("credited").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique("uq_promo_owner").on(t.promoCodeId, t.ownerId)]); // the race guard

export const creditPurchase = pgTable("credit_purchase", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id),
  packId: varchar("pack_id", { length: 32 }).notNull(),
  credits: integer("credits").notNull(),
  amountEtb: numeric("amount_etb", { precision: 10, scale: 2 }).notNull(),
  chapaTxRef: varchar("chapa_tx_ref", { length: 64 }).notNull().unique(), // the replay guard
  status: purchaseStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});
```

Notes:

- `credit_purchase` may already exist in M2's payment service — if so, **reuse it** and add
  only what's missing (this table is the reference shape, not a mandate to duplicate).
- No wallet/balance table here **by design** (§1, §2).
- `perAccountLimit` defaults to 1 — a code redeems once per account unless explicitly raised.

---

## 4. API keys

**Format:** `evn_live_<43 base62 chars>` from `crypto.randomBytes(32)`. `evn_test_` is
*reserved* for a future sandbox mode — reject it everywhere for now so nothing squats on it.

**Storage:** SHA-256 hex of the full key in `key_hash` (unique index — this IS the lookup
column: hash the presented key, one indexed equality query). `key_prefix` (first ~12 chars) and
`last4` exist only for the dashboard/logs. **The raw key is returned exactly once**, in the
create response; regeneration = revoke + create new. There is no recovery.

Why plain SHA-256, no salt/pepper: keys carry 256 bits of entropy, so offline cracking of a
leaked hash table is infeasible and rainbow tables don't apply. Adding a pepper adds a
key-management liability for no real gain. (This is the same posture GitHub/Stripe take for
high-entropy tokens.) Don't "harden" this with bcrypt either — per-request bcrypt on a hot
decode path is pure latency.

**Hard rules (the auth-conventions section of CLAUDE.md, extended):**

- `/v1` **never** reads cookies or better-auth sessions. `/api/v1/dev/*` **never** accepts API
  keys. Two disjoint identity channels; mixing them reintroduces CSRF-shaped bugs.
- Identity for charging is `req.apiKey.ownerId` — resolved server-side from the hash. Never
  from a header, never from the body (same spirit as "never read `x-user-id`").
- Never log a raw key or the raw `Authorization` header. Log `keyPrefix` only.
- A 401 must not disclose *why* (missing vs unknown vs revoked vs expired) — same message for
  all: `{"error":{"code":"unauthorized","message":"Invalid API key"}}`.

**Middleware `middleware/apiKeyAuth.ts` → `requireApiKey`:**

```ts
const raw = bearerToken(req) ?? req.headers["x-api-key"];       // accept both
if (!raw || typeof raw !== "string") throw unauthorized();
const key = await db.query.apiKey.findFirst({ where: eq(apiKey.keyHash, sha256hex(raw)) });
if (!key || key.status !== "active" || (key.expiresAt && key.expiresAt < new Date()))
  throw unauthorized();                                          // one message for all cases
req.apiKey = key;
touchLastUsed(key);   // fire-and-forget, only if lastUsedAt is >60s stale (don't write per request)
```

---

## 5. The `/v1` request pipeline

Public routes mount at **`/v1`** on the same Express app (no path collision — everything
internal lives under `/api/*`). If/when an `api.ethiovin.com` subdomain is pointed at the same
Passenger app, `/v1` works there unchanged; the mount is host-agnostic.

Pipeline order (in `routes/publicRoutes.ts`):

```
ipFloodLimiter → requireApiKey → perKeyLimiter → zod schema → controller
```

- `ipFloodLimiter` — generous per-IP backstop (**300 req/min/IP**) so a single box can't melt
  the app even with many keys. Deliberately generous: corporate NAT means many customers can
  share one IP; the *real* limits are per-key.
- `invalidKeyLimiter` — **30 failed auths / 15 min / IP** counted only on 401s (blunts key
  brute force; with 256-bit keys this is belt-and-braces).
- `perKeyLimiter` — the tier limit, dynamic per key:

  ```ts
  export const perKeyLimiter = rateLimit({
    windowMs: 60_000,
    keyGenerator: (req) => req.apiKey!.id,          // NOT the IP
    limit: (req) => req.apiKey!.rateLimitPerMin,
    standardHeaders: "draft-7",                      // RateLimit-* headers
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({
      error: { code: "rate_limited", message: "Rate limit exceeded. Retry after the window resets." },
    }),
  });
  ```

- **Error/404 shape:** `/v1` has its own router-level `notFound` + error handler emitting the
  public envelope `{ "error": { "code", "message", "doc_url"? } }`. The global `errorHandler`
  keeps the internal `{ error: "..." }` string shape — **do not merge them**; internal clients
  and external clients have different, frozen contracts. A `PublicApiError extends AppError`
  carrying `code` keeps controllers throw-based (Express 5 forwards async throws).
- **Existing limiters don't apply:** `apiLimiter` is mounted on `/api/v1/vin/*` only, so `/v1`
  is untouched — correct, since it's IP-based and would punish shared-IP customers.
- ⚠️ **Memory store is per-process.** Passenger/LiteSpeed may spawn multiple workers → the
  effective RPM multiplies by worker count. For launch, pin the app to one instance
  (`PassengerMaxInstancesPerApp 1` / panel setting) or accept the slop; a Redis store is the
  backlog fix *only if* we ever scale out. Restarts reset the counters — acceptable (windows
  are 60 s; credits are the durable control).
- ⚠️ **Postgres pool is `max: 1`.** Fine for the internal tool; public traffic + webhook on a
  single connection will queue. Bump modestly before launch (e.g. `max: 5`) within the cPanel
  Postgres connection cap — verify the host's limit first.
- CORS: **do not add `/v1` to the CORS allow-list and do not add a permissive CORS layer for
  it.** Keys are server-side secrets; browser usage means leaked keys. CORS absence doesn't
  affect server-to-server callers at all. (Check that the existing `cors` origin callback
  passes requests with *no* Origin header — curl/SDKs send none — it must not 500 them.)

---

## 6. Charging rules (order matters — this section is testable law)

Inside `publicApiController.decode`:

1. Validate body (Zod: bounded plain string — **no I/O/Q rejection**, same rationale as
   `scanSchema`; `parseVin` is the authority). Cleaned length ≠ 17 → `422 invalid_vin`, free,
   log `result: "invalid"`.
2. Decode via `decodeService` → outcome `exact | model | none`.
3. `none` → respond parse-only, **0 credits**, log `parse_only`.
4. `exact`/`model` → `creditBridge.charge({ amount: 1, ref: "decode:" + requestId })`.
   The charge must be a **conditional decrement inside a transaction** (ledger-guard
   equivalent of `UPDATE ... SET balance = balance - 1 WHERE balance >= 1 RETURNING`) — two
   concurrent requests must not drive a 1-credit wallet to −1.
5. Charge succeeded → respond with `vehicle` + `specs` + `credits: { charged: 1, balance }`.
   **Charge failed (raced to zero or empty) → `402 insufficient_credits` WITHOUT the vehicle
   or specs.** Never return paid data on a failed charge; yes, we did the lookup "for free" —
   a wasted cheap read beats leaking the product.
6. Every request writes an `api_request_log` row (result, credits_charged, http_status,
   latency_ms, ip, request_id) — including errors. This is the billing-dispute record.

**Idempotency (`Idempotency-Key` header, optional, ≤64 chars):** on first sight, store
`(apiKeyId, idemKey, requestHash, response)` after responding. On replay within 24 h with the
same body hash → return the stored response verbatim, **no second charge**. Same key,
*different* body → `409 idempotency_conflict`. Rows are pruned by the same job as logs (§15).
This exists because paid-API retries (client timeouts, batch reruns) otherwise become
double-charge complaints.

---

## 7. Billing (Chapa) & promo codes

**Checkout flow:**

1. Portal → `POST /api/v1/dev/billing/checkout { packId }` (session-authed). Server looks up
   the pack in `lib/pricing.ts`, inserts `credit_purchase(status: "pending")` with
   `tx_ref = "evnp_" + uuid`, calls Chapa *initialize* (amount, `currency: "ETB"`, tx_ref,
   return_url = portal billing page), returns `{ checkout_url }`.
2. User pays on Chapa (telebirr / CBE Birr / cards — Chapa aggregates).
3. Chapa → `POST /api/v1/dev/billing/webhook`. ⚠️ **Raw-body gotcha, same family as the
   better-auth handler:** the signature is an HMAC over the raw payload, so this ONE route is
   registered in `index.ts` **before** `express.json()`, with `express.raw({ type: "*/*" })`.
   Verify the `x-chapa-signature`/`Chapa-Signature` HMAC-SHA256 against
   `CHAPA_WEBHOOK_SECRET`, **then also call Chapa's verify API**
   (`GET /v1/transaction/verify/:tx_ref`) before crediting — the webhook alone is spoofable if
   the secret ever leaks; the verify call is authoritative. Then, in one transaction:
   `pending → paid` (a status-transition guard — `paid` rows are terminal, re-delivery is a
   200 no-op) + `creditBridge.grant({ source: "purchase", ref: "purchase:" + tx_ref })`. The
   unique `chapa_tx_ref` is the replay guard.
4. The portal return page polls `GET /api/v1/dev/billing/purchase/:txRef` and, as a fallback,
   the server re-verifies on that poll if still `pending` — Chapa's redirect often lands
   before the webhook does.

**Promo codes:**

- `POST /api/v1/dev/billing/promo { code }` (session-authed). Normalize: trim + UPPERCASE.
- Transactional redeem: `SELECT ... FOR UPDATE` the promo row → validate `status`,
  `starts_at`/`expires_at` window, `max_redemptions` vs `redeemed_count`, per-account count →
  `INSERT promo_redemption` (the `unique(promoCodeId, ownerId)` constraint is the real race
  guard) → `redeemed_count + 1` → `creditBridge.grant({ source: "promo", ref: "promo:" +
  promoId + ":" + ownerId })`. Return the new balance.
- Distinct error codes: `promo_invalid`, `promo_expired`, `promo_exhausted`,
  `promo_already_redeemed`. Rate-limit redemption attempts (**10 / 15 min per account**) so
  codes can't be enumerated.
- Generated codes exclude ambiguous chars (`0 O 1 I`); manual codes (e.g. `ETHIOVIN25`) are
  allowed as-is.

---

## 8. Public surface (summary — `API_REFERENCE.md` is the external source of truth)

- `POST /v1/decode` — the product. Body `{ "vin": "..." }` → the envelope below.
- `POST /v1/decode/batch` — **implemented** (2026-07-17). Body `{ "vins": [...] }`, 1..50 VINs;
  each VIN decoded + charged INDEPENDENTLY (same charging law as `/decode`), partial results
  (per-VIN result or `error` envelope), always HTTP 200 unless the batch body itself is malformed
  (→ `422 invalid_request`). Batch-level `Idempotency-Key`. Shares `decodeCore` with `/decode`;
  charges run sequentially so a batch can't overspend the balance.
- `GET /v1/account` — balance, calling-key info, month-to-date usage.
- `GET /v1/usage?from=YYYY-MM-DD&to=YYYY-MM-DD` — per-day counts from `api_request_log`.
- `GET /v1/health` — public, unauthenticated, mirrors `/health`.

**The envelope (never the internal `/scan` union):**

```json
{
  "request_id": "req_x7Kd91mQ2p",
  "vin": "LCO...",
  "valid": true,
  "match": "exact" | "model" | "none",
  "parsed": { "wmi": "LCO", "vds": "CE4CB", "vis": "...", "plant_code": "S",
              "model_year": 2025, "country": "China", "manufacturer": "..." },
  "vehicle": { "make": "...", "model": "...", "year": 2025, "image_url": "..." } | null,
  "specs": { "...sections..." } | null,
  "credits": { "charged": 1, "balance": 249 }
}
```

- `match: "exact"` — this VIN is in the ledger. `"model"` — same `(wmi, vds)` verified from
  another vehicle of the same model; specs are shared model-level hardware, **year still
  decoded from the caller's VIN** (the cache never shares year — CLAUDE.md rule). `"none"` —
  parse-only, free.
- `model_year` is documented to external devs as decoded-from-VIN, i.e. a strong heuristic,
  not a registration record — the same caveat the internal doc carries.
- **Why POST, not `GET /v1/vin/:vin`:** VINs in URLs end up in proxy/access logs and CDN
  caches; POST keeps them in bodies and pairs naturally with `Idempotency-Key`. One canonical
  endpoint, no alias.
- **Versioning policy:** `/v1` is frozen — additive fields only; anything breaking is `/v2`.

---

## 9. Developer-portal backend (`/api/v1/dev/*`, session-authed) + admin

New `routes/devPortalRoutes.ts` + `controllers/devPortalController.ts`:

- `GET  /keys` — list (prefix, last4, name, status, rate limit, lastUsedAt — never hashes).
- `POST /keys { name }` — create; response contains the **raw key once**. First-ever key for
  the account also fires the signup grant (§1).
- `DELETE /keys/:id` — revoke (status flip + `revokedAt`; rows are never deleted — logs FK them).
- `GET  /billing/packs` — the live pricing table via `pricingService.getPricingConfig()`
  (`app_settings["pricing"]`, falling back to `DEFAULT_PRICING`).
- `POST /billing/checkout { packId }`, `GET /billing/purchase/:txRef`,
  `POST /billing/promo { code }` — §7.
- `GET  /billing/history` — purchases + promo redemptions + grants for the account.
- `GET  /usage/summary` — dashboard aggregates (daily decodes, hit ratio, credits spent).

⚠️ **Gating footguns:**

- Gate **per-route** with `requireAuth` — do NOT gate the router at mount, because
  `POST /billing/webhook` is unauthenticated (signature-verified instead) and, per §7, is
  registered in `index.ts` before the JSON parser anyway. Keep the webhook OUT of the
  session-gated router entirely.
- These routes use `requireAuth`, **not** `requireRole` — being an API customer is orthogonal
  to the M1/M2 contributor roles (`user`-role accounts can buy credits and decode via API;
  they still can't verify specs). Product decision — flag if wrong.

Admin (existing `adminRoutes.ts` pattern: router gated at mount, routes super_admin,
audit-logged):

- `POST/GET/PATCH /api/v1/admin/promo` — promo CRUD (create with generated or manual code,
  disable, list with redemption counts).
- `GET  /api/v1/admin/credits/lookup?email|ownerId` — look up an account + its live balance
  (backs the `/admin/credits` user-lookup panel).
- `POST /api/v1/admin/credits/grant { ownerId | email, amount, note }` — manual grants
  (enterprise bank-transfer deals, goodwill) via `creditBridge.grant({ source: "admin_grant",
  ref: "admin:" + uuid })`.
- `GET`/`PATCH /api/v1/admin/pricing` — read/update the runtime pricing config (packs +
  signup-grant size) in `app_settings["pricing"]` via `pricingService` (§1).
- `PATCH /api/v1/admin/api-keys/:id/limit { rateLimitPerMin }` — enterprise overrides.

Keyless demo (landing live-demo, no auth, rate-limited): `GET /api/v1/dev/demo` lists a few real
already-cached sample VINs from the ledger, `GET /api/v1/dev/demo/:vin` returns the public decode
envelope for one — so the landing demo shows real data without spending a credit or a key.

---

## 10. `web/` additions (landing, dashboard, docs)

All three follow `web/DESIGN.md` tokens — no new design system.

**Landing — `/developers`** (the product's own front door; also the target if a standalone
domain is pointed here later):

1. Hero: "Decode any VIN imported to Ethiopia — make, model, year, verified specs — one API
   call." CTA: *Get a free API key* (→ signup → dashboard). Terminal-style **live demo**: a
   dropdown of 3–5 canned sample VINs (real, already-cached models) → a server route that
   decodes them without touching credits, per-IP limited. Canned-only = zero AI/Serper cost
   and nothing for scrapers to farm.
2. How it works: send VIN → matched against the verified Ethiopian import database → specs
   JSON. (Three steps, one code block.)
3. **Why not a global decoder** — the honest differentiators, straight from the M1 conventions:
   handles ASEAN-market VINs containing I/O/Q that global decoders reject or mis-shift;
   correct model-year decode for the pre-2010 import fleet (position-7 cycle logic);
   human-verified specs, not scraped guesses; self-improving coverage of the actual Ethiopian
   car park; pay in ETB (telebirr/CBE via Chapa).
4. Pricing: free grant + the packs (rendered from `/billing/packs` — no hardcoded numbers).
5. Code samples: tabs for `curl`, Node (`fetch`), Python (`requests`).
6. Use cases: insurance underwriting, bank auto-loan collateral checks, marketplaces/listings,
   customs & import brokers, fleet onboarding.
7. FAQ + link to docs. Footer.

**Dashboard — `/dashboard/api`** (session-gated): *Keys* tab (create modal with the show-once
key + copy button and a "you won't see this again" warning; revoke), *Usage* tab (daily decode
chart, hit ratio, credits spent — from `/usage/summary`), *Billing* tab (balance, packs →
Chapa checkout, promo-code input, transaction history).

**Docs — `/developers/docs`:** rendered **from repo-root `API_REFERENCE.md` at build time**.
Single source — do not fork the contract into JSX copy; if the render pipeline needs the file
copied into `web/`, make it a build step, not a manual copy.

---

## 11. Environment variables (`backend/.env` additions)

- `CHAPA_SECRET_KEY` — Chapa API secret (initialize + verify calls). A `CHASECK_TEST-` key runs
  **test/sandbox mode** (no real money; `chapaService.isTestMode()` surfaces this to the portal
  as a badge); a `CHASECK-` key is live. Test vs live is decided purely by this key — no flag.
- `CHAPA_WEBHOOK_SECRET` — the webhook signature secret (Chapa dashboard "secret hash").
  Optional for local testing: the billing tab's return-poll (`GET /billing/purchase/:txRef` →
  `settlePurchase` → authoritative verify) settles a purchase even when no webhook can reach the box.
- `PUBLIC_API_BASE_URL` — e.g. `https://api.ethiovin.com`; used for `doc_url` fields in error payloads.
- `PUBLIC_WEB_URL` — the **web portal** origin (where `/dashboard/api` lives). The Chapa
  `return_url` redirects the browser here after checkout, NOT to the API. Falls back to the first
  `FRONTEND_URL` origin, then `PUBLIC_API_BASE_URL`. (Fixes a real bug: the return_url used to be
  built from the API base, so the post-checkout redirect 404'd unless the portal shared that host.)

**Chapa test-mode contract (verified against developer.chapa.co, 2026-07):** `/transaction/initialize`
requires `amount`+`currency`+`tx_ref`+`email` (we send all four) and accepts optional
`first_name`/`last_name`/`phone_number`/`callback_url`/`return_url`/`customization`; the webhook is a
POST carrying `chapa-signature` (= HMAC-SHA256 of the *secret* keyed by the secret) and
`x-chapa-signature` (= HMAC-SHA256 of the *payload* keyed by the secret) — `verifyWebhookSignature`
accepts either. Test cards (Visa `4200 0000 0000 0000`, CVV 123, exp 12/34) and test telebirr/CBE
numbers (`0900123456`, `0900112233`, `0900881111`) complete a sandbox payment. See `LAUNCH.md` →
"Testing Chapa in test mode" for the full step-by-step.

No key-hashing pepper (§4 explains why). Missing Chapa vars should disable billing routes
with a clear 503 log line at boot rather than crashing the whole app — decoding must keep
working if billing config is absent in a dev environment.

---

## 12. Security notes

- Keys hashed at rest, shown once, revocable; `evn_test_` rejected (reserved). Raw keys and
  `Authorization` headers never logged.
- Uniform 401 (§4); invalid-key attempts IP-limited (§5).
- No CORS on `/v1`; docs explicitly warn "server-side use only — never ship your key in a
  browser or mobile app".
- Webhook: HMAC check + authoritative verify-API call + unique `tx_ref` + terminal-state
  guard (§7).
- Promo redemption rate-limited per account (§7); codes generated without ambiguous chars.
- `helmet()` already applies app-wide; `/v1` serves JSON only so nothing extra needed.
- Public responses expose no internal ids beyond `request_id` (nanoid, not the bigserial —
  serials leak volume).
- Admin grant/promo endpoints are super_admin + audit-logged — money movement always leaves a
  trail (`credit_purchase`, `promo_redemption`, ledger refs).

---

## 13. Failure registry

| # | Failure | Guard |
|---|---------|-------|
| 1 | Double charge on client retry | `Idempotency-Key` replay cache (§6); ledger refs unique |
| 2 | Webhook replay / spoof | HMAC + verify-API call + unique `chapa_tx_ref` + `pending→paid` terminal transition (§7) |
| 3 | Wallet race to negative | Conditional decrement inside a transaction (§6.4) |
| 4 | Paid data returned on failed charge | Response-order law (§6.5); test asserts no `specs` on 402 |
| 5 | Charging a parse-only miss | Business rule §1; test asserts `charged: 0` on `match:"none"` |
| 6 | Key brute force | 256-bit keys + `invalidKeyLimiter` + uniform 401 |
| 7 | Multi-worker limiter slop | Pin Passenger to 1 instance at launch; Redis store is the scale-out fix (§5) |
| 8 | Limiter reset on restart | Accepted — 60 s windows; credits are the durable control |
| 9 | Free-grant farming | Grant fires once per account on first key, unique ledger ref; requires a real signup (M2 email verification — confirm it's on) |
| 10 | Pool starvation under public load | Bump postgres-js `max` before launch within host cap (§5) |
| 11 | Promo enumeration | Per-account redeem limiter + non-ambiguous generated codes (§7) |
| 12 | Contract drift between docs and code | `API_REFERENCE.md` is the single source; docs page renders it; envelope changes are additive-only in v1 (§8) |

---

## 14. Build order

- **T1** — Schema (§3) + `m3.sql` + `db:generate`/`db:push`; Zod schemas in `validation.ts`
  (`publicDecodeSchema`, `createKeySchema`, `checkoutSchema`, `promoRedeemSchema`).
- **T2** — `apiKeyService` (generate/hash/verify/revoke) + `requireApiKey` + the three
  limiters + `/v1` router skeleton with its own notFound/error envelope.
- **T3** — `creditBridge`: **read `claude.milestone2.md` first**, verify the M2 credit-service
  signatures, decide user-vs-org owner scoping. Nothing charges before this lands.
- **T4** — `POST /v1/decode`: decodeService mapping → envelope, charging law (§6), request
  logging. The heart of the milestone.
- **T5** — `GET /v1/account`, `GET /v1/usage`, `GET /v1/health`.
- **T6** — Dev-portal keys CRUD + signup grant.
- **T7** — `lib/pricing.ts` + packs endpoint + Chapa checkout + webhook (raw-body mount) +
  return-page verify fallback.
- **T8** — Promo service + redeem + admin promo CRUD + admin grant.
- **T9** — Idempotency (§6) — after the happy path is stable.
- **T10** — `web/` dashboard (keys/usage/billing).
- **T11** — Landing page + canned-VIN live demo.
- **T12** — Docs page rendered from `API_REFERENCE.md`.
- **T13** — Hardening: tests for registry items 3/4/5, 402 vs 429 semantics, rate-limit
  headers, webhook replay, promo race.
- **T14** — Launch checklist: run `m3.sql` on prod, set envs, pin Passenger instances, bump
  pool, schedule the prune script, seed a launch promo, smoke-test with a real Chapa
  test-mode payment.

T1–T5 are sequential; T6–T8 can interleave; T10–T12 need T5–T8. M3 assumes M2's
`decodeService` and credit ledger are merged — if not, T3/T4 stub against the bridge
interface and the bridge is the last thing wired.

---

## 15. Stubs / handoffs / backlog

- ~~`POST /v1/decode/batch` — 501 with the reserved contract (§8).~~ **DONE 2026-07-17** — implemented per §8.
- `evn_test_` sandbox mode — prefix reserved, rejected, unimplemented.
- Per-key IP allowlist (jsonb column) — phase 2.
- OpenAPI spec + generated SDKs — backlog; `API_REFERENCE.md` is the contract until then.
- Redis rate-limit store — only if the app scales past one Passenger instance.
- Tax receipts / formal invoices for enterprise — pending business answer (open input #5).
- `npm run logs:prune` — deletes `api_request_log` + `api_idempotency` rows older than 180
  days; wire to a cPanel cron. Ships with T14.
- Monthly free-credit refresh — deliberately NOT included (one-time grant only); revisit with
  real usage data.

---

## 16. Open business inputs (block launch copy, not the build)

1. **Wallet scope** — spec assumes ONE shared balance with M2 (§1/§2). Confirm, or API gets
   its own wallet (strongly discouraged).
2. **Pricing** — pack sizes/ETB prices + free-grant size (25). Placeholders live only in
   `lib/pricing.ts`.
3. **Payment rails** — Chapa only at launch? Manual bank transfer for enterprise is covered by
   the admin grant; direct telebirr integration deferred?
4. **Hosting** — `/v1` on the same Passenger app (assumed). Is `api.ethiovin.com` planned, and
   does the landing live at `<main-site>/developers` or its own domain?
5. **Misses** — parse-only decodes are free (assumed). Charge a reduced amount instead?
