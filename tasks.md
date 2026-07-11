# tasks.md — Claude's working note-taker / task journal

> My scratch + progress notes (formerly note.claude.md). Not user-facing docs — the formal docs are
> `CLAUDE.md`, `claude.milestone2.md`, `MILESTONE_2_PLAN.md`, `claude.report.md`. Keep per-task
> progress, decisions, and gotchas here. Plan source: `MILESTONE_2_PLAN.md`; decisions also in memory.

## Post-loop additions (2026-06-25)
- Super_admin payments toggle shipped (app_settings + settingsService; /payments/config + /admin/settings;
  account hides Get Premium when off; app/admin/settings toggle). Backend typecheck+build clean.
- VERIFIED THE BUILD: `cd web && npm install` (127 pkgs), `npx tsc --noEmit` clean, `npm run build`
  clean (17 routes; /decode/[vin] dynamic/SSR). Backend `npm run typecheck` + `npm run build` (esbuild,
  90.5kb) clean. Design system audited: all raw colors only in web/app/globals.css — zero hardcoded
  hex/inline-style in pages/components. 3 moderate npm-audit advisories in web dev deps (Next chain).
- DOC RESTRUCTURE: CLAUDE.md slimmed (M2 detail -> claude.milestone2.md) + Documentation-map chapter
  added; this file renamed note.claude.md -> tasks.md.
- Pending: user to push branch milestone-2 + review. DB migration still a handoff (db:generate; not push).

## Mode
Self-paced coding loop. Branch: `milestone-2` (off `main`). NOT pushing. Committing each
iteration as a checkpoint on the branch so progress survives.

## Settled decisions (don't re-litigate)
- Stack: KEEP Express/Drizzle/Postgres/better-auth backend (extend). Frontend → Next.js App Router
  (reuse React components), deploy FE Vercel, API cPanel. (Frontend re-platform comes AFTER backend
  foundations — extend the working API first, lower risk.)
- Monetization: build credit ledger + trust engine now as NEUTRAL infra; redemption behind
  `CREDIT_REDEMPTION_MODE` flag, decided after phase 3.
- Insurance: reciprocal data-sharing exchange; minimize at BOTH gates; `data_sharing_agreements`
  table = lawful basis; barter metered via credit ledger. (§3b of plan.)

## Hard rules I must keep
- Derive wmi/vds/year on the SERVER via parseVin — never trust client. (CLAUDE.md)
- parseVin keeps I/O/Q; vds_code = substring(3,8) = 5 chars. Don't touch decode correctness.
- ESM imports need `.ts` extension.
- requireRole takes SPREAD args, not an array.
- Trust scoring: NO entry authoritative until corroborated; score changes ONLY on flag resolution,
  never on entry. (The dangerous part — get the state machine right.)
- Regulated data (insurance/police): minimize at intake, strip PII at egress, audit every access.
- Credit ledger: append-only + running balance + lock; never SUM() under a race.
- Payments: signature verify + idempotency key + reconcile; duplicate webhook grants premium once.
- Additive migrations only. Do NOT run db:push/db:migrate against the user's real DB without asking.
- Don't auto-commit to main; don't push; don't run destructive git.

## Task order (from plan)
- [x] T1 — DB: add M2 tables to schema.ts (additive)
- [x] T2 — middleware: requireOrg, requireTier, audit() (authMiddleware.ts + audit.ts)
- [x] T2b — Zod validation schemas for new bodies (validation.ts)
- [x] T6 — trust corroboration state machine (services/trustService.ts + field_claims table)
- [x] T7 — credit ledger helper (services/creditService.ts, append-only + advisory lock + balance)
- [x] T5 — decode free/premium serializer split (services/decodeView.ts)
- [x] decode endpoints: /api/v1/decode/:vin (public free) + /:vin/full (premium) + audit
- [x] event ingestion spine: services/eventService.ts (ingestVehicleEvent + recordVehicleEvent)
- [x] T9 — garage (FULL) COMPLETE: T9a core+job-close-emit, T9b appointments, T9c parts, T9d invoicing.
- [x] T10 — insurance reciprocal exchange (insuranceController + healthGrade; both gates minimized)
- [x] T8 — payments (ETB) idempotent webhook -> premium (paymentService/Controller/Routes)
- [x] T11 — admin onboarding (orgs/members/agreements) + analytics (adminController/Routes)
=== BACKEND M2 FEATURE-COMPLETE ===
- [x] T3 — design tokens + Next.js web/ scaffold (globals.css tokens + tailwind.config + DESIGN.md)
- [~] T4 — Next.js pages (incremental):
      - [x] iter B — lib/api.ts, SiteHeader, VinSearch, landing page, SSR /decode/[vin]
      - [x] iter C — auth-client, login/signup, AuthNav island, account + paywall checkout
      - [~] iter D — authed dashboards (split):
            - [x] D1 garage (AppShell + jobs/detail/customers/appointments/parts)
            - [x] D2 insurer (vehicle lookup health grade + claim/police minimized intake)
            - [x] D3 super_admin (analytics + onboarding: orgs/members/agreements)
=== FRONTEND CORE COMPLETE (funnel + auth/paywall + garage/insurer/admin dashboards) ===
- [ ] T12 — perf: raise pool size (indexes already in schema), SSG/ISR free decode
- [ ] T13 — fix M1 conflict write-path (trust depends on it)
- [ ] DB migration: run db:generate + apply (hand to user; do NOT db:push)

## Open decisions
- [x] Trust penalty curve: CONFIRMED 2026-06-23 "Forgiving start" (2/3/−10, no escalation, floor 0)
      = the coded default. TRUST_CONFIG in trustService.ts is now authoritative.
- [x] Garage-management depth: CONFIRMED 2026-06-24 FULL — customers/CRM, jobs+items+totals,
      appointments, parts inventory+reorder, invoicing, job close→event. Build across sub-iters.
- (none open now — all M2 decisions resolved)

## Progress log
- 2026-06-23 iter1: branch `milestone-2` created; note started; full M2 schema added (T1);
  typecheck clean; committed d87696a.
- 2026-06-23 iter2: T2 done — requireOrg/requireTier (authMiddleware.ts) + audit helper/middleware
  (audit.ts); T2b done — M2 Zod schemas (validation.ts, incl. insurance intake minimization gate).
  Note: exactOptionalPropertyTypes is ON — optional fields passed as possibly-undefined need
  `?: T | undefined` in interfaces. Typecheck clean; committed 9fcbfc4.
- 2026-06-23 iter3: T6 trustService + field_claims table; T7 creditService. Both use
  pg_advisory_xact_lock for per-key serialization. Typecheck clean; committed dd8cf24.
  Trust curve confirmed "Forgiving start" (= default); committed 042d1c2.
- 2026-06-23 iter4: T5 buildDecodeView (services/decodeView.ts) — free tier = basic spec teaser +
  history count; premium = full specs + history. Typecheck clean; committed ebd5e1f.
- 2026-06-23 iter5: decode endpoints (decodeController + decodeRoutes), public /decode/:vin mounted
  outside auth in index.ts, premium /:vin/full audited. resolveVehicle reuses processVin lookup
  order. Typecheck clean; committed a7d4b57.
- 2026-06-23 iter6: eventService spine (ingestVehicleEvent + recordVehicleEvent) — idempotent event
  insert + trust-weighted credit + per-field corroboration in one tx; reads score via tx (pool-safe).
  Typecheck clean; committed 5311e9c. Garage depth confirmed FULL; committed decision.
- 2026-06-24 iter7: T9a garage core (garageController + garageRoutes, mounted /api/v1/garage gated
  requireOrg("garage")). customers + jobs + items + totals; job close emits event + odometer
  (rollback-flagged) idempotently. All queries scoped req.org.id. Typecheck clean; committed bed1c25.
- 2026-06-24 iter8: T9b appointments (create/list w/ status+date filters/reschedule). Scoped
  req.org.id. updateAppointmentSchema added. Typecheck clean; committed a334413.
  Note: classifier (PowerShell AND Bash) intermittently unavailable — retry the command, it clears.
- 2026-06-24 iter9: T9c parts inventory (create/list ?lowStock/patch w/ atomic qtyDelta). Scoped
  req.org.id. updatePartSchema added. Typecheck clean; committed 5e26541.
- 2026-06-24 iter10: T9d invoicing (garage_jobs.paid/paidAt additive; GET /jobs/:id/invoice derive,
  PATCH /jobs/:id/pay). FULL GARAGE COMPLETE. Typecheck clean; committed fd5e1d6.
- 2026-06-24 iter11: T10 insurance exchange (insuranceController + insuranceRoutes mounted
  /api/v1/insurance gated requireOrg("insurer") + assertAgreement; healthGrade.ts pure helper;
  resolveVehicle exported from decodeController). Intake minimized (only health signal stored),
  egress = identity+grade+event-summary (no PII), barter exchange debit, audited. Typecheck clean;
  committed d3bf93b.
- 2026-06-24 iter12: T8 payments (paymentService stub adapter + paymentController + paymentRoutes
  /api/v1/payments). /init requireAuth; /webhook PUBLIC + idempotent (advisory lock + status guard)
  grants premium_access +30d once; /me history. Typecheck clean; committed a75f3c6.
  Note: premium_access inserts a new active row per payment (no unique userId) — requireTier just
  needs one active row; dedupe later if needed. Webhook is behind apiLimiter — may need higher cap.
- 2026-06-24 iter13: T11 admin onboarding (POST /admin/orgs, /orgs/members, /agreements; PATCH
  /agreements/:id/revoke) + GET /admin/analytics. Typecheck clean; committed 547754b.
  *** BACKEND M2 FEATURE-COMPLETE *** (decode/garage/insurance/payments/admin all done).
- 2026-06-24 iter14: T3 frontend scaffold — web/ Next.js 15 app (package.json/next.config/tsconfig/
  postcss/tailwind.config), PURE DESIGN SYSTEM tokens in app/globals.css (warm orange/amber, type
  scale, radius, elevation, motion) + component primitives (.btn-brand/.btn-ghost/.card), layout,
  placeholder home, DESIGN.md, favicon, .env.example. Committed 39ce064.
  *** NOT typechecked/installed *** — user must `cd web && npm install` before `npm run dev`.
  Frontend files validated by review only (no Next toolchain in loop). NEXT: T4 landing+decode pages.
- 2026-06-24 iter15: T4 iter B public funnel — lib/api.ts (typed DecodeView), SiteHeader, VinSearch
  (client, keeps I/O/Q), real landing (hero/how-it-works/network/tiers), SSR app/decode/[vin] (free
  view + paywall). Token-only. Committed 0892896. Still not installed. NEXT: login + authed shell.
  Next 15 note: dynamic route params is a Promise — `const { vin } = await params`.
- 2026-06-24 iter16: T4 iter C auth+paywall — lib/auth-client.ts (better-auth/react + adminClient),
  app/login (signin/up, Suspense around useSearchParams), AuthNav island in SiteHeader, app/account
  (premium CTA -> /payments/init -> checkout + history). better-auth added to web deps. Committed
  a4f49bb. Still not installed. NEXT: iter D dashboards (split D1 garage / D2 insurer / D3 admin).
  Note: checkout.checkoutUrl is the STUB url (pay.stub.local) — won't load until real ETB provider.
- 2026-06-24 iter17: T4 D1 garage dashboard — AppShell (session-gated sidebar, reusable), lib/navs,
  NotMember; garageApi helpers; pages jobs board + job detail (items/close/invoice/pay) + customers
  + appointments + parts. Committed a5fbaed. Still not installed. NEXT: D2 insurer dashboard.
  Next 15 client note: use useParams() hook in client pages (not the async params prop).
- 2026-06-24 iter18: T4 D2 insurer dashboard — insurerApi (lookup/claim/police); pages: vehicle
  lookup (health grade + factors + event summary, no PII), claim + police minimized intake forms.
  403 surfaces backend message (not-a-member vs no-agreement). Committed 482cf6a.
- 2026-06-24 iter19: T4 D3 super_admin dashboard — AppShell requireRole gate; adminApi; pages
  analytics (stat cards + orgs/events tables), orgs (create+add member), agreements (create JSON
  scope + revoke). Committed d567ee5. *** FRONTEND CORE COMPLETE *** NEXT: T13 backend + wrap pass.

## Pending DB migration (hand to user; do NOT run db:push)
Schema changed since M1 (all additive): all M2 tables (T1) + field_claims + garage_jobs.paid/paidAt.
Generate with `npm run db:generate` and apply via adjust.sql/generated migration when user confirms DB.

## Gotchas / learnings
- crypto.randomUUID() is available globally (Node 22) — used by vehicle_ledger already.
- DB pool is max:1 — raise later (T12).
- No DATABASE_URL guaranteed locally → I can typecheck but should NOT run db:push; will
  generate migration files only when safe, else hand off migration to user.

## LOOP COMPLETE (2026-06-24 iter20)
T13 conflict write-path wired + typecheck clean (committed c246b7a). Wrap pass done: CLAUDE.md
updated (M2 section + conflict backlog marked done), claude.report.md written. Loop STOPPED — no
more wakeups scheduled. Remaining = handoffs only (cd web && npm install; db:generate migration;
real ETB payment keys; raise DB pool T12). Backend feature-complete + frontend core complete.
Branch milestone-2 NOT pushed (user decides).

## (historical) Next iteration — T13 (backend conflict write-path) + wind-down
Backend, branch milestone-2:
  T13 — wire the M1 conflict detection (CLAUDE.md backlog): in vinController.submitVerifiedSpec,
  when a DIFFERENT proposed spec arrives for an existing VERIFIED (wmi,vds) key, set vds_cache.status
  = "conflict" instead of silently overwriting, and keep logging both proposals to verification_log
  (already happens). ConflictsPanel + POST /resolve already exist to clear it. Compare incoming
  hardware_specs vs current spec blob; if different and current status verified -> conflict.
  Typecheck. Commit.
Then WIND DOWN the loop (frontend core + backend feature-complete): do a final wrap pass —
  update CLAUDE.md (note Next.js web/ app, new tables/routes, the conflict write-path now wired),
  leave a short claude.report.md progress report (milestone asked for it), and STOP scheduling new
  iterations. Summarize remaining handoffs: cd web && npm install; DB migration (db:generate); real
  ETB provider keys; T12 pool size raise. Do NOT keep looping after the wrap — end cleanly.

---

## M3 wrap plan (2026-07-11) — build one by one, per user

Backend `/v1` API platform (T1–T9 + T14 partial) is DONE, typechecks + bundles, pushed to
`milestone-2`. Remaining, in order:

- [x] **Step 1 — web/ developer portal (T10–T12)** — DONE. Dashboard (keys/usage/billing),
  landing (+ live demo), docs (renders API_REFERENCE.md via prebuild copy). Backend added
  `GET /dev/usage/summary` + keyless `GET /dev/demo/:vin`. web `tsc` + `next build` clean (21 routes).
  - `/dashboard/api`: Keys tab (create modal w/ show-once key + copy + "won't see again"
    warning; revoke), Usage tab (daily decodes/hit-ratio/credits from `/dev/usage/summary`
    or `/v1/usage`), Billing tab (balance, packs → Chapa checkout, promo input, history).
  - `/developers`: landing (hero + free-key CTA, canned-VIN live demo, how-it-works,
    why-not-a-global-decoder, pricing from `/billing/packs`, curl/Node/Python samples, FAQ).
  - `/developers/docs`: render repo-root `API_REFERENCE.md` at build time (single source).
  - Follow `web/DESIGN.md` tokens; no new design system. Needs `GET /dev/usage/summary`
    (add to backend) + a canned-VIN demo route (server, per-IP limited, no credits).
- [x] **Step 2 — failure-registry tests (T13)** — DONE. `npm test` (node:test via tsx):
  unit suite (key format/hash, webhook HMAC verify, promo non-ambiguous codes, pricing, ids,
  parseVin I/O/Q) 7 pass. DB-integration (wallet race → never negative, charge law, hasGrantRef)
  behind `RUN_DB_TESTS=1` so they never touch the real cPanel DB by accident — 4 skipped here.
  - wallet race → never negative; no `specs` on 402; parse-only `charged:0`; 402≠429;
    webhook replay is a no-op; promo double-redeem blocked; invalid VIN free.
- [ ] **Step 3 — verify backend live**
  - boot against a DB, smoke-test `/v1/decode` (miss/hit/402), key create+use, promo,
    checkout stub. Hand off the interactive Chapa test-payment.
- [ ] **Step 4 — wrap**
  - update CLAUDE.md pointers if surface changed; final `claude.report.md`; push.
