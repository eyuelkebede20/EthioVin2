# EthioVin — Milestone 2 Progress Report

_Branch: `milestone-2` (off `main`, not pushed). Date: 2026-06-24._
_Plan + CEO review: `MILESTONE_2_PLAN.md`. Build journal: `note.claude.md`._

## What M2 is
Turning the VIN decoder into a multi-sided, self-improving data network: a public free/premium
decode funnel, a trust-scored contributor network (garages, insurers, diagnosticians), a credit
economy, and a new server-rendered frontend. Backend stayed Express + Drizzle + Postgres +
better-auth (extended, not rewritten); the frontend was re-platformed to Next.js.

## Shipped (all type-checks clean; committed incrementally on `milestone-2`)

### Backend — feature complete
- **Schema:** ~20 additive Drizzle tables around `vehicle_events` (the history spine) — orgs +
  membership + data-sharing agreements, premium/payments, garage management, regulated
  insurance/police, trust (`data_flags`/`field_claims`/`score_adjustments`/`contributor_scores`),
  `credit_ledger`, `audit_log`.
- **Access:** `requireOrg` (org-scoping / IDOR boundary), `requireTier` (premium 402 gate),
  `audit()` + `writeAudit()` (append-only, visible-on-failure).
- **Services:** trust corroboration state machine (score changes only on resolution), append-only
  credit ledger (advisory-locked, running balance), shared event-ingestion spine (idempotent +
  trust-weighted credit + corroboration), free/premium serializer, pure health-grade, payment adapter.
- **Endpoints:** public `/decode/:vin` (free) + `/full` (premium); `/garage/*` (full management:
  customers, jobs+items+invoice, appointments, parts); `/insurance/*` (minimized intake + insurer
  health view); `/payments/*` (idempotent webhook → premium); `/admin/*` (onboarding + analytics).
- **T13:** conflict write-path wired — a differing spec proposal flags `conflict` for review instead
  of silently overwriting.
- **Payments toggle:** super_admin can switch payments on/off (`app_settings` + `/admin/settings`);
  `/payments/init` returns 503 and the upgrade UI hides when off.

## Verification (2026-06-25)
- Backend: `npm run typecheck` clean, `npm run build` (esbuild) clean — 90.5 kB bundle.
- Frontend: `cd web && npm install` ok, `npx tsc --noEmit` clean, `npm run build` clean — all 17
  routes compile, `/decode/[vin]` is server-rendered.
- Design system: audited token-discipline — every raw color lives only in `web/app/globals.css`;
  no hardcoded hex or inline styles in any page/component. Build validates all `@apply` tokens resolve.
- Minor: 3 moderate npm-audit advisories in the `web/` Next build chain (dev tooling, non-blocking).

### Frontend — core complete (`web/`, Next.js 15)
- Pure design-system tokens (`globals.css` → Tailwind), `DESIGN.md`.
- Public funnel: landing page (explains the product) + SSR `/decode/[vin]` (shareable, crawlable —
  the SPA gap this re-platform fixes) with a free teaser + history-count paywall.
- Auth (login/signup, session-aware nav) + account page with premium checkout.
- Dashboards: garage (jobs/detail/customers/appointments/parts), insurer (health lookup + minimized
  claim/police intake), super_admin (analytics + org/member/agreement onboarding).

## All six CEO-review critical gaps closed
Trust race (resolution-only scoring), credit race (advisory-locked ledger), payment idempotency
(webhook grants once), odometer rollback (flagged not 500), IDOR (org-scoping + audit), and the
`pool: max 1` bottleneck is documented for raising (T12).

## Security posture (the "ISO" ask, made concrete)
Data minimization (insurer raw claims dropped at the Zod intake gate; garage PII stripped at the
insurer egress), RBAC/org-scoping, append-only audit logging, and a provable/revocable
`data_sharing_agreements` lawful basis. Certification itself remains an org/legal track.

## Stubbed / deferred
- **Payments:** provider calls are stubbed (`pay.stub.local`) — wire real Telebirr/Chapa/Santimpay
  keys + HMAC webhook signature verification before production.
- **Credit redemption model:** built as neutral infra; redemption rule deferred behind
  `CREDIT_REDEMPTION_MODE` (decide after phase 3, per the CEO review).

## Handoffs (what you run / decide)
1. **Frontend:** `cd web && npm install && npm run dev` — the web app was authored and reviewed but
   not built in the loop; install + run to exercise it and catch any wiring issues.
2. **DB migration:** `cd backend && npm run db:generate`, then apply via a generated migration or
   `adjust.sql`. **Do not `db:push` against prod.** All schema changes are additive.
3. **Payments:** add real ETB provider keys + signature verification.
4. **Perf (T12):** raise the Postgres pool size for the garage write load.
5. **Deploy:** frontend → Vercel/Netlify (`NEXT_PUBLIC_BACKEND_URL`); API stays on cPanel.

## Post-review hardening + cPanel deploy + super_admin dashboard (2026-06-25)

### Gemini code review — all findings actioned
- **F1 (blocker):** backend esbuild no longer `--packages=external` — `dist/index.js` is now a
  self-contained 5.7 MB bundle (createRequire banner for CJS interop). Boot-verified.
- **F2:** `web` decode page forwards cookies, fetches `/decode/:vin/full` when entitled, renders a
  full premium report (specs + history); free teaser otherwise.
- **F3:** `resolveConflict` accepts the baseline verified spec (the `/log` path seeds no
  `verification_log` row) so conflicts can resolve in favour of the original.
- **F5:** conflict detection uses `util.isDeepStrictEqual`, not order-sensitive `JSON.stringify`.
- **F6:** new `GET /payments/me/entitlement`; account page reads live entitlement (expires correctly).
- **F4:** Next.js `output: "standalone"` + a `deploy.yml` web job that builds the standalone server
  and FTPs it to `/home/senaycre/ethiovin-web` (Passenger Node app, startup `server.js`). Legacy
  `client/` deploy kept until cutover. Verified locally: standalone server serves `/` and `/decode`.

### cPanel runtime notes
- Backend Node app **startup file must be `dist/index.js`** (self-contained). Running `src/index.ts`
  crashes with `ERR_MODULE_NOT_FOUND` (no `node_modules` shipped) → API down → CORS/login failures
  downstream. Error logs are now ISO-timestamped (module-resolution crashes still pre-date app code).

### super_admin dashboard completed (claude.second.md points 6 & 8)
- Backend reads (super_admin, read-only): `GET /admin/orgs`, `GET /admin/orgs/:id`,
  `GET /admin/contributors`, `GET /admin/flags`.
- `web/app/admin`: **Organizations** now lists orgs with expandable members + agreements (inline
  add/revoke — no blind ID paste; old Agreements page removed). New **Trust & Fraud** page (contributor
  scores + data-flag queue with competing entries) and **Conflicts** page (resolve spec conflicts).
- Verified: backend `tsc` clean; `web` `tsc` + `next build` clean (18 routes).

## Not in scope (deferred, per the plan)
Mobile/OCR scan, public dealer API, insurer risk-pricing product, ISO 27001 certification, Japan
chassis decoding.

---

# EthioVin — Milestone 3 Progress Report

_Branch: `milestone-2` (M3 built here; detail in `claude.milestone3.md`, contract in `API_REFERENCE.md`)._

## What M3 is
Packages the decode engine as a standalone, sellable developer product: a keyed public API
(`POST /v1/decode`) metered by prepaid **credits**, purchasable in ETB via **Chapa** or promo
codes, with a developer portal for keys/usage/billing. Additive to M1/M2 — same Express app,
same Postgres, same `web/`; **one shared credit balance** with M2 (no second wallet).

## Shipped — backend API platform (T1–T9; `tsc` + esbuild bundle clean; committed incrementally)

- **T1 Schema:** 6 additive tables + 4 enums (`api_key`, `api_request_log`, `api_idempotency`,
  `promo_code`, `promo_redemption`, `credit_purchase`); idempotent `db/m3.sql`; migration `0004`;
  M3 Zod schemas. Zero changes to existing tables.
- **T2 Keys/pipeline:** `apiKeyService` (`evn_live_` 256-bit keys, SHA-256 lookup, show-once,
  revoke; `evn_test_` reserved+rejected); `requireApiKey` (Bearer/X-API-Key, uniform 401);
  `ipFlood`/`invalidKey`(401-only)/`perKey`(dynamic tier) limiters; `/v1` router with its OWN
  `{ error: { code, message, doc_url? } }` envelope, isolated from the internal shape.
- **T3 Credit bridge:** single adapter over M2's `credit_ledger` — `charge` (guarded serialized
  decrement → `InsufficientCreditsError`), `grant` (optional caller tx for atomic guard-row +
  grant), `balance`, `hasGrantRef`. Owner = `user.id` (one balance per account confirmed).
- **T4/T9 Decode:** `POST /v1/decode` — parse-only & invalid VINs free, hits charged 1 credit via
  guarded decrement, **no paid data on a failed charge (402)**, full request logging, and
  `Idempotency-Key` replay (same key+body → stored response, no re-charge; different body → 409).
- **T5 Account/usage/health:** `GET /v1/account`, `GET /v1/usage` (per-day, ≤92d), `GET /v1/health`.
- **T6 Portal keys:** `/api/v1/dev/keys` CRUD (ownership-checked); first key fires the one-time
  25-credit signup grant (idempotent via ledger ref); new-key RPM defaults by purchase history.
- **T7 Billing (Chapa):** `lib/pricing.ts` (single price source), `/billing/packs|checkout|
  purchase/:txRef`; `chapaService` (initialize + authoritative verify + raw-body HMAC webhook);
  `settlePurchase` (verify → pending→paid + grant + tier bump in one tx, terminal-state + unique
  `tx_ref` replay guards); webhook mounted pre-`express.json()`; poll-fallback re-verify.
- **T8 Promo/admin:** transactional promo redeem (row lock + `unique(promo,owner)` race guard +
  distinct `promo_*` codes + per-account limiter); admin promo CRUD, manual credit grant
  (by id/email), key-limit override — all audit-logged, super_admin.
- **T14 (partial):** `DB_POOL_MAX` (default 5) pool bump; `npm run logs:prune` (180-day retention).

## Shipped — web portal + tests + live verify (T10–T13)

- **T10–T12 `web/`** (`tsc` + `next build` clean, 21 routes): `/dashboard/api` (Keys tab with
  show-once key + copy + warning + revoke; Usage tab stat tiles + daily bar chart; Billing tab
  balance + packs→Chapa + promo redeem + Chapa-return poll + history), `/developers` landing
  (hero, canned-VIN live demo, how-it-works, why-not-global, pricing from `/billing/packs`,
  curl/Node/Python samples, use cases, FAQ), `/developers/docs` (renders repo-root
  `API_REFERENCE.md` via a prebuild copy step — single source, no forked JSX). Backend added
  `GET /dev/usage/summary` + keyless `GET /dev/demo/:vin`.
- **T13 tests** (`npm test`, node:test via tsx): DB-free unit suite (key format+hash, webhook
  HMAC verify, promo non-ambiguous codes, pricing, ids, parseVin I/O/Q) — 7 pass; DB-integration
  suite (wallet race → never negative, guarded charge law, hasGrantRef) behind `RUN_DB_TESTS=1`.
- **Live verify (read-only, cPanel DB):** booted the API, caught + fixed a runtime-only bug
  (`ERR_ERL_KEY_GEN_IPV6` → `ipKeyGenerator`), confirmed `/v1/health`, the keyless 401 public
  envelope, and a correct live `/dev/demo/:vin` envelope end-to-end.

## Remaining handoffs (need real creds / would write to prod)
- **T14 launch:** run `m3.sql` on prod, set `CHAPA_SECRET_KEY`/`CHAPA_WEBHOOK_SECRET`/
  `PUBLIC_API_BASE_URL`, pin Passenger to 1 instance (or add a Redis limiter store), cron
  `npm run logs:prune`, seed a launch promo, and add `web/` to the CI/deploy pipeline.
- **Interactive smoke test:** create a key → charged decode → 402-on-empty, and a real Chapa
  test-mode payment through checkout → webhook. Run `RUN_DB_TESTS=1 npm test` on a throwaway DB.
- **Pricing sign-off:** the pack prices + 25-credit signup grant in `lib/pricing.ts` are placeholders.
- **Demo VINs:** swap the 3 canned sample VINs in `devPortalController` for real already-cached ones.

## New env vars (backend/.env)
`CHAPA_SECRET_KEY`, `CHAPA_WEBHOOK_SECRET`, `PUBLIC_API_BASE_URL` (see `claude.milestone3.md` §11);
optional `DB_POOL_MAX`, `LOG_RETENTION_DAYS`. Missing Chapa vars disable billing (503), not decode.

---

# EthioVin — post-M3 hardening + launch prep (2026-07-18)

Session focused on documentation, the last real feature, and making billing testable. All on
`milestone-2` (pushed).

## Shipped
- **Docs front door:** root `README.md` (was missing), `backend/.env.example` + `client/.env.example`,
  hardened `.gitignore` (real `.env` files were unprotected), and `LAUNCH.md` — the ordered prod
  runbook (verified the `milestone-2 → main` diff is fully additive: no DROP/ALTER-DROP/TRUNCATE).
- **`POST /v1/decode/batch`** (was a 501 stub): 1..50 VINs, each decoded + charged independently
  (same charging law as `/decode`), partial results, batch-level idempotency, sequential guarded
  charges. Shares a new `decodeCore` with `/decode` (one decode path). `invalid_request` (422) added.
- **Chapa test-mode + a real bug fix:** the `return_url` was built from the API origin but
  `/dashboard/api` is a `web/` route → post-checkout redirect 404'd; now uses `PUBLIC_WEB_URL`.
  Added `isTestMode()` + branded `customization`; reviewed the integration against Chapa's live docs
  (initialize/verify/dual-header webhook HMAC all match).
- **Zero-signup `BILLING_MOCK_MODE`:** simulates the full buy→settle→credit flow with no Chapa
  account; gated so it can never activate in prod (a real key always wins). Unit-tested.

## Verified
- Backend typecheck + esbuild build + `npm test` (13, DB-integration behind `RUN_DB_TESTS=1`) clean;
  `web/` typecheck + `next build` clean.
- **Billing flow proven end-to-end** on a throwaway local DB (never prod): signup grant 25 →
  buy 200-credit pack (mock) → balance 225 → idempotent re-settle stays 225.
- Prod probe: M1 API live (`/health` 200); `/v1` not yet deployed (404) — merge is gated on
  applying `m2.sql`+`m3.sql` to the prod DB first (LAUNCH.md L1).

## Closed earlier handoffs (superseded)
- ~~Pricing sign-off~~ — pricing is runtime-editable (`app_settings["pricing"]` / `/admin/pricing`).
- ~~Demo VINs~~ — `/dev/demo` pulls real cached ledger rows.
- ~~Batch decode~~ — implemented (above).

## Remaining (operator's hands)
- **L1 apply schema to prod**, then **merge `milestone-2 → main`** (fires the full deploy).
- **L2 prod env:** `CHAPA_SECRET_KEY` (+ webhook secret), `PUBLIC_WEB_URL`, `PUBLIC_API_BASE_URL`.
  Until then billing is 503 (decode works).
- Confirm the `web/` portal is deployed + domain-mapped (the landing's developer links point at it).
- New env vars this session: `PUBLIC_WEB_URL` (billing return origin), `BILLING_MOCK_MODE` (dev only).
