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
- [ ] T5 — decode free/premium serializer split   ← NEXT (after trust-curve answer)
- [ ] new vin endpoints: /decode (public free + gated premium), /history
- [ ] T9 — garage: jobs/appointments/parts/customers; job close → vehicle_event
- [ ] T10 — insurance reciprocal exchange (both minimization gates)
- [ ] T8 — payments provider integration (ETB)
- [ ] T11 — admin analytics + org onboarding
- [ ] T3 — design system tokens (frontend)
- [ ] T4 — Next.js shell + public/authed routing + SSR decode + login + paywall
- [ ] T12 — perf: pool size, indexes (mostly in schema), SSG/ISR
- [ ] T13 — fix M1 conflict write-path (trust depends on it)

## Open decisions (don't block phases 1–3; ask user when reached)
- Garage-management depth: minimum vs full (before T9).
- Trust penalty curve: confirm default (−5..−15 minority per confirmed bad entry).

## Progress log
- 2026-06-23 iter1: branch `milestone-2` created; note started; full M2 schema added (T1);
  typecheck clean; committed d87696a.
- 2026-06-23 iter2: T2 done — requireOrg/requireTier (authMiddleware.ts) + audit helper/middleware
  (audit.ts); T2b done — M2 Zod schemas (validation.ts, incl. insurance intake minimization gate).
  Note: exactOptionalPropertyTypes is ON — optional fields passed as possibly-undefined need
  `?: T | undefined` in interfaces. Typecheck clean; committed 9fcbfc4.
- 2026-06-23 iter3: T6 trustService + field_claims table; T7 creditService. Both use
  pg_advisory_xact_lock for per-key serialization. Typecheck clean; committed dd8cf24.
  LOOP PAUSED — asking user to confirm the trust penalty curve (TRUST_CONFIG in trustService.ts)
  before relying on it. Built with proposed defaults (corroborateAt 2, resolveAt 3, penalty 10).

## Gotchas / learnings
- crypto.randomUUID() is available globally (Node 22) — used by vehicle_ledger already.
- DB pool is max:1 — raise later (T12).
- No DATABASE_URL guaranteed locally → I can typecheck but should NOT run db:push; will
  generate migration files only when safe, else hand off migration to user.

## Next iteration
PAUSED on the trust penalty curve decision (asked the user). Once answered: update TRUST_CONFIG
in services/trustService.ts to match, then resume with T5 — split the decode response into free
(make/model/year/basic specs) vs premium (full specs + history) serializers, one function with a
tier param (req.tier from requireTier). Then the /decode (public free + gated premium) and /history
endpoints. Re-arm the loop with ScheduleWakeup after the user answers.
