# EthioVin

**A self-improving VIN decoder built for the Ethiopian car park.**

EthioVin decodes a Vehicle Identification Number into make, model, year and verified hardware
specs. When a vehicle's model hasn't been seen before, an admin verification flow (Gemini spec
draft + image search) fills the gap — and the verified result is cached, so every future car of
the same model decodes instantly. That cache is the "self-improving" core: coverage grows as the
network records more vehicles.

It's built for the vehicles Ethiopia actually imports — ASEAN-market VINs (which legitimately
contain the characters `I`, `O`, `Q` that many global decoders wrongly strip), correct model-year
decoding for the large pre-2010 import fleet, and human-verified spec data.

---

## Project status

| Milestone | What it is | Status |
|-----------|-----------|--------|
| **M1** | The core VIN decoder + admin verification + two-brain cache | ✅ Shipped (in prod) |
| **M2** | Contributor network: free/premium funnel, trust scoring, credit economy, garage & insurer dashboards, Next.js frontend | ✅ Code-complete on `milestone-2` |
| **M3** | Public API platform: keyed `/v1/decode`, prepaid credits, Chapa billing, promo codes, developer portal | ✅ Code-complete on `milestone-2`; **not yet in prod** |

**Active branch:** `milestone-2` (M2 + M3 both live here, all additive to M1). The public
marketing landing page ships to prod from this branch via a client-only deploy; the M2/M3 backend
and `web/` portal are pending launch (see [Launch status](#launch-status)).

---

## Repository layout (monorepo)

Two-and-a-half packages, **no root `package.json`** — run `npm` inside each package.

```
ethiovinv2/
├── backend/    Express 5 API — Node 22, ESM, Drizzle + Postgres, better-auth   (M1 + M2 + M3)
├── web/        Next.js 15 App Router portal — the current frontend             (M2 + M3)
├── client/     React 19 + Vite SPA — the legacy M1 frontend (marketing landing lives here now)
├── .github/    CI: deploy.yml (main → full deploy) + deploy-client.yml (landing only)
└── *.md        Documentation (see the map below)
```

**Node 22+ is required across all packages** (host + CI run Node 22; some deps enforce it via
`engines`). Node 20 will warn or fail to install.

---

## Architecture at a glance

### The two-brain cache (the self-improving core)

- **Brain 1 — `vehicle_ledger`:** one row per scanned VIN — the exact per-VIN identity record
  (make/model/year/image + decoded fields + a copy of the specs).
- **Brain 2 — `vds_cache` + `vehicle_specs`:** the shared "DNA", keyed on `(wmi, vds_code)`
  (manufacturer + hardware code). Different VINs of the same model share this key and hit the
  cache instantly. A verified spec is stored once and serves every future car of that model.

VIN parsing is **always derived on the server** by `parseVin()` — never trusted from the client.
The single most important convention lives in [`CLAUDE.md`](./CLAUDE.md) ("VIN parsing — THE most
important convention"); read it before touching decode logic.

### The three layers

1. **Decode engine (M1)** — `parseVin` → cache lookup → hit (serve specs) or miss (admin verifies,
   AI drafts, result is cached).
2. **Contributor network (M2)** — organizations (garages/insurers/diagnosticians) contribute
   vehicle events under trust scoring and data-sharing agreements; a credit ledger meters value
   exchange; a free/premium decode funnel.
3. **Public API platform (M3)** — hashed API keys, a prepaid credit balance (one shared wallet
   with M2), per-key rate limits, Chapa (ETB) checkout for credit packs, and a developer portal.
   Public routes mount at `/v1`; the contract is frozen in [`API_REFERENCE.md`](./API_REFERENCE.md).

### Backend route map (`backend/src/index.ts`)

| Mount | Auth | Purpose |
|-------|------|---------|
| `GET /health` | none | Liveness probe |
| `/v1/*` | API key (hashed) | **Public developer API** — decode/account/usage/health |
| `/api/auth/*` | better-auth | Sign in/up/session |
| `/api/v1/vin/*` | session | Internal scan/verify/log/specs |
| `/api/v1/dev/*` | session | Developer portal — keys/billing/usage/demo |
| `/api/v1/decode/*` | session | Internal free/premium decode views |
| `/api/v1/garage/*` | session + org(garage) | Garage management |
| `/api/v1/insurance/*` | session + org(insurer) | Insurer exchange |
| `/api/v1/payments/*` | mixed | Premium checkout + webhook |
| `/api/v1/admin/*` | super_admin / garage_admin | Onboarding, analytics, promo, pricing |

> `/v1` and `/api/v1/dev/*` are **two disjoint identity channels**: `/v1` reads only API keys and
> never sessions; `/api/v1/dev/*` reads only sessions and never API keys.

---

## Quick start (local development)

### Prerequisites
- Node 22+
- A PostgreSQL database (connection string for `DATABASE_URL`)

### 1. Backend API

```bash
cd backend
npm install
cp .env.example .env        # then fill in the vars below
npm run db:seed             # seed WMIs + NHTSA models (first run)
npm run dev                 # tsx watch on PORT (default 3000)
```

Applying the schema to a **fresh** DB: run the idempotent SQL bootstrap files rather than replaying
migrations (the early `0000–0002` SQL was never committed):

```bash
psql "$DATABASE_URL" -f backend/src/db/m2.sql   # M2 tables (idempotent)
psql "$DATABASE_URL" -f backend/src/db/m3.sql   # M3 tables (idempotent)
```

### 2. Web portal (Next.js — the current frontend)

```bash
cd web
npm install
npm run dev                 # set NEXT_PUBLIC_BACKEND_URL to the backend origin
```

### 3. Legacy SPA (Vite — marketing landing + M1 UI)

```bash
cd client
npm install
npm run dev                 # set VITE_BACKEND_URL
```

---

## Environment variables

### `backend/.env`

| Var | Required | Purpose |
|-----|:--------:|---------|
| `DATABASE_URL` | ✅ | Postgres connection string (throws at boot if missing) |
| `BETTER_AUTH_URL` | ✅ | better-auth base URL |
| `BETTER_AUTH_SECRET` | ✅ | better-auth signing secret |
| `FRONTEND_URL` | ✅ | Comma-separated allowed CORS origins (throws at boot if empty) |
| `GEMINI_API_KEY` | ✅ | Google GenAI key (AI spec drafts) |
| `SERPER_API_KEY` | ✅ | Serper key (image search) |
| `PORT` | — | Server port (default 3000) |
| `CHAPA_SECRET_KEY` | M3 | Chapa checkout (missing → billing returns 503, decode still works) |
| `CHAPA_WEBHOOK_SECRET` | M3 | Chapa webhook HMAC verification |
| `PUBLIC_API_BASE_URL` | M3 | Public base URL used in API responses/docs |
| `PUBLIC_WEB_URL` | M3 | Web-portal origin — where the Chapa `return_url` redirects after checkout (falls back to the first `FRONTEND_URL` origin) |
| `BILLING_MOCK_MODE` | dev | `=1` (with **no** `CHAPA_SECRET_KEY`) simulates the buy→credit flow locally with no Chapa account. Never set in prod — a real key always overrides it |
| `DB_POOL_MAX` | — | Postgres pool size (default 5) |
| `LOG_RETENTION_DAYS` | — | `logs:prune` retention (default 180) |

### `web/.env`
- `NEXT_PUBLIC_BACKEND_URL` — backend origin.

### `client/.env`
- `VITE_BACKEND_URL` — backend origin (baked into the build).

---

## The public API

`POST /v1/decode` decodes one VIN, metered by prepaid credits (1 credit per decode that returns
data; parse-only misses and invalid VINs are **free**). Authentication is a hashed API key created
in the developer dashboard.

```bash
curl -X POST https://api.ethiovin.com/v1/decode \
  -H "Authorization: Bearer $ETHIOVIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"vin": "LCO..............."}'
```

The full, versioned contract — endpoints, the `match` field, credits, idempotency, error envelope,
code samples — is in **[`API_REFERENCE.md`](./API_REFERENCE.md)**, which is also the source rendered
at the portal's `/developers/docs` page. Change that file before changing any `/v1` code.

---

## Commands

### `backend/`
| Command | What it does |
|---------|-------------|
| `npm run dev` | Dev server (`tsx watch`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | esbuild bundle → `dist/index.js` (prod artifact) |
| `npm start` | `node dist/index.js` (prod) |
| `npm test` | Failure-registry tests (DB-integration behind `RUN_DB_TESTS=1`) |
| `npm run smoke` | Live `/v1` smoke test (`BASE_URL`/`API_KEY`/`CACHED_VIN` env) |
| `npm run db:generate` / `db:push` / `db:migrate` / `db:seed` / `db:studio` | Drizzle schema tooling |
| `npm run logs:prune` | Prune `api_request_log` past retention |

### `web/`
`npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint`

### `client/`
`npm run dev` · `npm run build` · `npm run lint` · `npm run preview`

---

## Testing

- **Unit** (DB-free): `cd backend && npm test` — key format/hash, webhook HMAC verify, promo code
  generation, pricing, ids, `parseVin` I/O/Q handling.
- **DB integration** (wallet-race → never-negative, the charging law, grant refs): `RUN_DB_TESTS=1
  npm test` — **run against a throwaway DB, never prod.**
- **Live smoke:** `BASE_URL=… API_KEY=… CACHED_VIN=… npm run smoke`.

---

## Deployment

CI is FTP-to-cPanel driven (`.github/workflows/`):

- **`deploy.yml`** (push to `main`) — builds `backend/` (esbuild bundle), `web/` (standalone) and
  `client/`, then FTP-deploys all three. **DB migrations are not run by CI** — apply the idempotent
  SQL files by hand.
- **`deploy-client.yml`** (push touching `client/**` on `milestone-2`) — FTPs only the built landing
  page to prod, so marketing can ship without pushing the not-yet-migrated M2/M3 backend.

Backend prod runs the **self-contained bundle** `dist/index.js` (startup file in cPanel's Node app
config). Running `src/index.ts` in prod crashes — no `node_modules` are shipped.

### Launch status

M2/M3 are code-complete but **not in production**. The exact ordered launch sequence (apply
`m3.sql` to prod, set Chapa env, pin Passenger, merge `milestone-2` → `main`, live smoke test,
real Chapa test payment, ops) is the copy-paste runbook **[`LAUNCH.md`](./LAUNCH.md)**. The whole
`milestone-2 → main` diff is additive (verified — no destructive DDL). These steps need production
credentials and are the operator's to run.

---

## Documentation map

| Doc | What's in it |
|-----|-------------|
| **`README.md`** (this) | Human front door — what/why, quickstart, architecture, deploy |
| [`CLAUDE.md`](./CLAUDE.md) | Engineering source of truth — conventions, VIN rules, cache model, auth, API surface. **Read first before coding.** |
| [`API_REFERENCE.md`](./API_REFERENCE.md) | The public `/v1` contract (frozen; source for the docs page) |
| [`claude.milestone2.md`](./claude.milestone2.md) | M2 detail — tables, middleware, services, the `web/` app |
| [`claude.milestone3.md`](./claude.milestone3.md) | M3 detail — API keys, credit metering, Chapa billing, promo codes |
| [`MILESTONE_2_PLAN.md`](./MILESTONE_2_PLAN.md) | The M2 CEO plan + 11-section review |
| [`claude.report.md`](./claude.report.md) | M2/M3 progress report — what shipped, what's stubbed, handoffs |
| [`LAUNCH.md`](./LAUNCH.md) | The ordered production launch runbook (schema → env → merge → smoke → payment → ops) |
| [`web/DESIGN.md`](./web/DESIGN.md) | The `web/` design-system token reference |
| [`tasks.md`](./tasks.md) | Build journal + the live launch checklist |

---

## Known deferrals

- **Payments** — provider webhook is real for Chapa; the legacy M2 premium adapter is still stubbed
  (`pay.stub.local`) pending final provider wiring.
- Orphaned `vehicle_specs` rows on repeat saves; `vehicle_ledger` duplicates specs instead of
  referencing a `spec_id`; legacy `fuelEnum`/`transEnum`/`bodyStyleEnum` enums are unused. See the
  "Known cleanup backlog" in [`CLAUDE.md`](./CLAUDE.md).
