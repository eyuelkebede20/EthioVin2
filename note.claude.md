# note.claude.md — Claude's personal working note (Milestone 2)

> My scratch/progress note for the M2 build. Not user-facing docs. Updated every loop iteration.
> Source of truth for the plan: `MILESTONE_2_PLAN.md`. Decisions also in project memory.

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
- [ ] T8 — payments provider integration (ETB)   ← NEXT
- [ ] T11 — admin analytics + org onboarding (org create + member add + data_sharing_agreement accept)
- [ ] T3 — design system tokens (frontend)
- [ ] T4 — Next.js shell + public/authed routing + SSR decode + login + paywall
- [ ] T12 — perf: pool size, indexes (mostly in schema), SSG/ISR
- [ ] T13 — fix M1 conflict write-path (trust depends on it)

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
  committed d3bf93b. NEXT: T8 payments.

## Pending DB migration (hand to user; do NOT run db:push)
Schema changed since M1 (all additive): all M2 tables (T1) + field_claims + garage_jobs.paid/paidAt.
Generate with `npm run db:generate` and apply via adjust.sql/generated migration when user confirms DB.

## Gotchas / learnings
- crypto.randomUUID() is available globally (Node 22) — used by vehicle_ledger already.
- DB pool is max:1 — raise later (T12).
- No DATABASE_URL guaranteed locally → I can typecheck but should NOT run db:push; will
  generate migration files only when safe, else hand off migration to user.

## Next iteration
T8 — payments (ETB). services/paymentService.ts + paymentController + paymentRoutes mounted
/api/v1/payments (requireAuth). Provider-agnostic skeleton (Telebirr/Chapa/Santimpay later):
  - POST /payments/init (paymentInitSchema {amount, provider}) — create a payments row status
    "pending" with a generated providerRef + idempotencyKey; return a checkout stub (no real
    provider call yet — env keys unknown). recordedBy req.user.id.
  - POST /payments/webhook — PUBLIC (mount OUTSIDE requireAuth like /decode): verify a signature
    placeholder, look up by providerRef, IDEMPOTENT via payments.idempotencyKey/status (a duplicate
    webhook must grant premium exactly ONCE): if status pending -> set succeeded AND grant
    premium_access (tier premium, expiresAt +30d) in one tx; if already succeeded -> no-op 200.
  - GET /payments/me — caller's payment history.
  Keep provider calls behind a clearly-stubbed adapter so real keys slot in later. Then T11 admin
  onboarding (org create + member add + data_sharing_agreement accept) so insurer/garage flows are
  reachable. Then frontend T3/T4. Loop RE-ARMED.
