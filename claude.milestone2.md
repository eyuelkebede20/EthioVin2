# claude.milestone2.md — Milestone 2 detail (the contributor network)

> Detailed working reference for M2. `CLAUDE.md` is the lean source of truth and points here.
> Companion docs: `MILESTONE_2_PLAN.md` (CEO plan + review), `claude.report.md` (status), `tasks.md`
> (build journal). Built on branch `milestone-2`.

M2 turns the decoder into a multi-sided data network: a public free/premium decode funnel, a
trust-scored contributor network (garages/insurers/diagnosticians), a credit economy, and a new
Next.js frontend. Backend stays Express + Drizzle + Postgres + better-auth (extended, NOT rewritten).

## Two frontends (cutover in progress)
- `client/` — the **M1 Vite SPA** (legacy). Gates everything behind login, passes data via router
  nav-state (no SSR, not shareable).
- `web/` — the **M2 Next.js 15 app** (App Router). Built to deploy on Vercel while the API stays on
  cPanel. This is where new frontend work goes.

### `web/` design system (pure tokens)
CSS-variable tokens in `web/app/globals.css` (warm orange/amber brand, type scale, radius, elevation,
motion) exposed to Tailwind in `web/tailwind.config.ts`. **Single source of truth — never hard-code a
hex in a component** (audited: all raw colors live only in `globals.css`). Component primitives:
`.btn-brand`, `.btn-ghost`, `.card`. Full reference: `web/DESIGN.md`.

### `web/` layout
- `lib/api.ts` — fetch wrapper + typed `DecodeView` (mirrors backend serializer) + `garageApi` /
  `insurerApi` / `adminApi` + payment helpers. `lib/auth-client.ts` — better-auth React client →
  Express `/api/auth`. `lib/navs.ts` — sidebar nav sets.
- `components/` — `SiteHeader` + `AuthNav` (session island), `AppShell` (session + optional
  `requireRole` gated dashboard shell), `VinSearch`, `NotMember`.
- Public: `app/page.tsx` (landing), `app/decode/[vin]` (SSR free decode + paywall). Auth:
  `app/login`, `app/account`. Dashboards: `app/garage/*`, `app/insurer/*`, `app/admin/*`.
- **Run:** `cd web && npm install && npm run dev`. Verified: `tsc` + `next build` pass (17 routes).
- **Deploy:** Vercel/Netlify with `NEXT_PUBLIC_BACKEND_URL`; API stays on cPanel.

## Backend additions

### Tables (`db/schema.ts`, all additive)
`organizations`, `organization_members`, `data_sharing_agreements`, `premium_access`, `payments`,
`app_settings`, `vehicle_events` (history spine), `field_claims`, `odometer_readings`,
`insurance_claims`*, `police_reports`*, `customers`, `garage_jobs`, `garage_job_items`,
`appointments`, `parts`, `contributor_scores`, `data_flags`, `score_adjustments`, `credit_ledger`,
`audit_log`. (* regulated: minimized + audited.) **Migration pending** — `npm run db:generate` then
apply; do NOT `db:push` against prod.

### Middleware (`middleware/`)
- `requireOrg(...types)` — gates an org dashboard, sets `req.org = { id, type, role }`; the
  org-A-can't-touch-org-B boundary (controllers scope every query by `req.org.id`).
- `requireTier("premium")` — premium gate; 402 when closed.
- `audit.ts` — `writeAudit()` + `audit()` (append-only, visible-on-failure, never breaks the request).

### Services (`services/`)
- `trustService.ts` — corroboration state machine. A value is trusted at `corroborateAt` agreeing
  entries; a conflict resolves by clear majority at `resolveAt`; the minority loses score **only on
  resolution, never on entry**. Curve = "Forgiving start" (2/3/−10) in `TRUST_CONFIG`.
- `creditService.ts` — append-only `credit_ledger`, per-user advisory lock + running balance (never
  `SUM()` under a race). Redemption gated by `CREDIT_REDEMPTION_MODE` (default `neutral`).
- `eventService.ts` — `ingestVehicleEvent`: shared write path (idempotent event + trust-weighted
  credit + per-field corroboration, one tx; reads score via `tx` not `db` for single-pool safety).
- `decodeView.ts` — `buildDecodeView`: the single free/premium tier boundary.
- `healthGrade.ts` — pure A–F vehicle grade from aggregated signals.
- `paymentService.ts` — provider adapter (STUBBED until ETB keys) + `grantPremium`.
- `settingsService.ts` — key/value flags; `getPaymentsEnabled()` (default on).

### Routes (under `/api/v1`)
- `GET /decode/:vin` — **public** free decode (funnel). `GET /decode/:vin/full` — premium.
- `/garage/*` (`requireOrg("garage")`) — customers, jobs (+ items, close→event), appointments,
  parts, invoice/pay.
- `/insurance/*` (`requireOrg("insurer")` + active agreement) — minimized claim/police intake +
  insurer-view vehicle lookup (identity + health grade + event summary; NO PII).
- `/payments/*` — `GET /config` (flag), `POST /init` (503 when payments off), **public** idempotent
  `POST /webhook` → premium grant, `GET /me`.
- `/admin/*` (super_admin) — `GET /orgs` (list + member/agreement counts), `POST /orgs`,
  `POST /orgs/members`, `GET /orgs/:id` (members + agreements), `POST /agreements`,
  `PATCH /agreements/:id/revoke`, `GET /analytics`, `GET /contributors` (trust scores, worst-first),
  `GET /flags` (data-flag queue + competing field_claims), `GET/PATCH /settings` (payments toggle).
  The trust/fraud reads are READ-ONLY — `trustService` owns score mutations.

### `web/` super_admin dashboard (`app/admin/*`)
`ADMIN_NAV`: Analytics · Organizations · Trust & Fraud · Conflicts · Settings.
- **Analytics** (`/admin`) — counts + orgs/events breakdown.
- **Organizations** (`/admin/orgs`) — lists every org; each row expands to members + agreements with
  inline add-member and create/revoke-agreement (no blind ID copy-paste). Folds in the old standalone
  Agreements page (removed).
- **Trust & Fraud** (`/admin/trust`) — contributor trust scores (100%→down, color-banded) + the
  data-flag queue showing each conflicting (vin, field) and its competing entries (point 8).
- **Conflicts** (`/admin/conflicts`) — groups `/vin/conflicts` by `(wmi, vds)`, previews each candidate
  spec (incl. the baseline), resolves via `POST /vin/resolve`.
- **Settings** (`/admin/settings`) — payments on/off toggle.

## Security posture (the "ISO" ask, made concrete)
Data minimization (insurer raw claims dropped at the Zod intake gate; garage PII stripped at the
insurer egress), RBAC + org-scoping, append-only audit logging, provable/revocable
`data_sharing_agreements` lawful basis. Certification itself stays an org/legal track.

## Conflict write-path (T13, done)
`submitVerifiedSpec` flags `vds_cache.status = "conflict"` when a *differing* `hardware_specs` proposal
arrives for an already-`verified` `(wmi, vds)` key (keeps the original verified spec; doesn't clobber),
logs both proposals to `verification_log`, and leaves resolution to `ConflictsPanel` + `POST /resolve`.
Identical re-submits stay verified; new/pending keys verify. (Blob compare is JSON-string,
order-sensitive — fine since the spec editor emits stable key order.)

## Stubs / handoffs / decisions
- **Payments:** provider calls stubbed (`createCheckout` / `verifyWebhookSignature`) — wire real
  Telebirr/Chapa/Santimpay keys + HMAC signature verification before production. Super_admin can
  toggle the whole feature off via `/admin/settings`.
- **Credit redemption model:** built as neutral infra; rule deferred behind `CREDIT_REDEMPTION_MODE`
  (decide after phase 3).
- **DB pool** is still `max: 1` — raise for garage SaaS write load.
- `premium_access` inserts a fresh active row per payment (no unique userId) — `requireTier` only
  needs one active row; dedupe later if wanted.
