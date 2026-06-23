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
- [x] T1 — DB: add M2 tables to schema.ts (additive)        ← DONE this iteration
- [ ] T2 — middleware: requireOrg, requireTier, audit()
- [ ] T2b — Zod validation schemas for new bodies
- [ ] T6 — trust corroboration state machine + helpers
- [ ] T7 — credit ledger helper (append-only + balance)
- [ ] T5 — decode free/premium serializer split
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
- 2026-06-23 iter1: branch created; note started. Adding full M2 schema (T1).

## Gotchas / learnings
- crypto.randomUUID() is available globally (Node 22) — used by vehicle_ledger already.
- DB pool is max:1 — raise later (T12).
- No DATABASE_URL guaranteed locally → I can typecheck but should NOT run db:push; will
  generate migration files only when safe, else hand off migration to user.

## Next iteration
T2 — auth middleware (requireOrg/requireTier/audit) + T2b Zod schemas for the new endpoints.
