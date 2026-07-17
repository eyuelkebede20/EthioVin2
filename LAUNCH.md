# LAUNCH.md — taking EthioVin M2 + M3 to production

The launch runbook. M2 (contributor network) + M3 (public API platform) are code-complete on
`milestone-2` but **not in production**. This file is the exact, ordered sequence to ship them.

> Companion: `tasks.md` → "M3 LAUNCH plan" (the same L1–L7 in journal form). This file is the
> operator's copy-paste version with the pre-flight facts already verified.

## Pre-flight facts (verified 2026-07-17)

- `milestone-2` is **25 commits / 79 files ahead of `main`**, and the diff is **fully additive** —
  no `DROP`, `ALTER … DROP`, or `TRUNCATE` in any migration; `backend/src/db/schema.ts` only adds
  tables/columns. Merging to `main` is safe **once the schema is applied** (L1 before L4).
- `backend/src/db/m2.sql` and `m3.sql` are **idempotent** (`CREATE … IF NOT EXISTS`, guarded enums
  + FKs) — safe to run even if a dev `db:push` already created some tables.
- `.github/workflows/deploy.yml` (push to `main`) builds + FTP-deploys **all three** packages:
  `client/` → `/public_html/ethiovin/`, `web/` (Next standalone) → `/ethiovin-web/`, `backend/`
  (esbuild bundle) → `/ethiovin-api/`. **CI does NOT run DB migrations** — that's L1, by hand.
- Rate limiters are **in-memory** (chosen for cPanel shared hosting) — accurate only if Passenger
  runs a single instance (L3).

## Ordering constraint (why the sequence matters)

```
L1 schema  ──▶  L2 env  ──▶  L3 pin Passenger  ──▶  L4 merge→main (deploys)  ──▶  L5 smoke  ──▶  L6 payment  ──▶  L7 ops
```

The new backend won't crash at boot without the M2/M3 tables (it connects, doesn't create), but
every `/v1` and `/api/v1/dev` request would error until the schema exists. **Always L1 before L4.**

---

## L1 — Apply the schema to the prod DB

Idempotent; run M2 first if the DB predates M2. **Do NOT `db:push` against prod.**

```bash
psql "$DATABASE_URL" -f backend/src/db/m2.sql   # only if the prod DB predates M2
psql "$DATABASE_URL" -f backend/src/db/m3.sql
```

Verify the M3 tables landed:

```bash
psql "$DATABASE_URL" -c "\dt api_key api_request_log api_idempotency promo_code promo_redemption credit_purchase"
```

## L2 — Set prod env (`backend/.env` on cPanel)

See `backend/.env.example` for the full list. The M3 additions:

```
CHAPA_SECRET_KEY=<from Chapa dashboard>
CHAPA_WEBHOOK_SECRET=<from Chapa dashboard>
PUBLIC_API_BASE_URL=https://ethiovinapi.senaycreatives.com
FRONTEND_URL=<existing origins>,https://ethiovin.senaycreatives.com,https://<web-portal-origin>
```

Missing Chapa vars → billing returns **503** (decode still works), so the API can go live before
payments are wired. Confirm `FRONTEND_URL` includes the `web/` portal origin or its browser calls
fail CORS.

## L3 — Pin Passenger to one instance

cPanel → **Setup Node.js App** for the API:
- Startup file: **`dist/index.js`** (the self-contained bundle — NOT `src/index.ts`).
- If the plan allows: `PassengerMaxPoolSize 1` / `PassengerMinInstances 1` (keeps the in-memory
  rate-limit counters exact). Leave `DB_POOL_MAX` at its default (5).

## L4 — Merge `milestone-2` → `main` (fires the full deploy)

Review the additive diff first, then merge. This triggers `deploy.yml` (client + web + backend).

```bash
git checkout main
git pull
git merge --no-ff milestone-2
git push origin main            # ← this is the deploy trigger
```

Watch the Actions run to green. The Passenger restart is automatic (the workflow rewrites
`tmp/restart.txt`).

## L5 — Smoke-test the live API

1. Create a throwaway key in the portal (`/dashboard/api`), and grab a demo VIN:
   `curl https://ethiovinapi.senaycreatives.com/api/v1/dev/demo` (keyless).
2. Run the scripted smoke (health → keyless 401 → free invalid → free unknown → charged cached →
   balance −1 → idempotent replay → **batch partial results** → malformed batch 422):

   ```bash
   cd backend
   BASE_URL=https://ethiovinapi.senaycreatives.com \
   API_KEY=<throwaway key> \
   CACHED_VIN=<demo VIN> \
   npm run smoke
   ```
3. Manually confirm the **402 path** the script can't self-run: drain a test key to 0 credits,
   decode a cached VIN → `402 insufficient_credits` with **no `specs`/`vehicle`** in the body.
4. Money-safety suite against a **throwaway** DB (never prod):
   `RUN_DB_TESTS=1 npm test`.

## L6 — Real Chapa test-mode payment

Checkout a credit pack in the portal → complete on Chapa (test mode) → webhook grants credits
**once** → balance rises. Replay the webhook and confirm it's a **no-op** (idempotent).

## L7 — Ops

- Cron `cd backend && npm run logs:prune` (default 180-day retention on `api_request_log`).
- Seed a launch promo: `POST /api/v1/admin/promo` (super_admin).
- Confirm `/developers` renders live packs from `/billing/packs` and `/developers/docs` renders
  the current `API_REFERENCE.md` (includes batch decode).

---

## Rollback

- **Schema** is additive — nothing to roll back; the new tables are inert to M1.
- **Deploy** — revert the merge commit on `main` and push; CI redeploys the prior bundle. The
  self-contained backend bundle means no partial-dependency states.
- **Billing** — unset the Chapa env vars to take payments offline (503) without touching decode.

## What's NOT blocking launch

Batch decode (`/v1/decode/batch`) is **implemented**. The legacy M2 premium adapter
(`pay.stub.local`) is still a stub, but the M3 public API monetization path (Chapa) is real and
independent of it.
