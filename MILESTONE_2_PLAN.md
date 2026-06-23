# EthioVin — Milestone 2 Plan (CEO Review, HOLD SCOPE)

Reviewed via `/plan-ceo-review` on 2026-06-23. Mode: **HOLD SCOPE, sequenced**.
Source of intent: `claude.second.md`. This document is the reviewed plan; it captures
the architecture, schema, sequencing, and the full 11-section rigor review.

> Stack decision: **keep the backend** (Express 5 + Drizzle + Postgres + better-auth + Zod) and
> **re-platform the frontend to Next.js (App Router)**, reusing existing React components.
> Frontend deploys to Vercel/Netlify; API stays on cPanel. Rationale: backend is clean and
> extensible; the SPA cannot serve a public, crawlable, shareable decode funnel (everything is
> behind `App.tsx:13` login, and data is passed via router nav-state, not fetched).

---

## 0. The shape of Milestone 2

M2 is not a feature. It is **8 systems** that turn a VIN decoder into a multi-sided data network:

1. Pure design system (tokens → consistency)
2. Public two-tier decode (free: model + basics; premium: full data + history) + landing + login
3. Premium vehicle-history aggregation (inspection / repair / maintenance / odometer / claims / police)
4. Garage management system (the highest-volume data source; also a standalone product for garages)
5. Insurance intake system (claims + police reports; minimized + regulated data)
6. Role-based hierarchy + super_admin analytics + onboarding of garages/insurers/diagnosticians
7. Credit / reward economy (sustainability: pay contributors for data)
8. Trust / fraud scoring (Upwork-style: start 100%, corroboration lowers it)

**Dependency order (the sequence that ships value instead of nothing):**

```
 [1 Design system] ─┐
                    ├─▶ [2 Public funnel + login] ──▶ acquisition works, users arrive
 [existing decode] ─┘            │
                                 ▼
              [3 Contributor schema + trust(100%) + credit ledger]   ← cross-cutting core
                                 │ (gives every data input an owner, a weight, a reward)
                    ┌────────────┼─────────────┐
                    ▼            ▼              ▼
            [4 Garage mgmt]  [5 Insurance]  [diagnostician inputs]
                    └────────────┼─────────────┘
                                 ▼
                  history fills ▶ premium tier has something to sell
                                 ▼
                       [6 super_admin analytics + onboarding]
```

Systems 7 (credits) and 8 (trust) are **cross-cutting** — they have no meaning until contributors
exist, so they are built as the *core* in phase 3 and then *wired into* every input path (4, 5, 6).

---

## 1. Architecture Review

### 1.1 System architecture (new components vs existing)

```
                         PUBLIC (no auth)                    AUTHED
   ┌──────────────────────────────────────┐   ┌───────────────────────────────────────┐
   │  Next.js (Vercel) — SSR/SSG           │   │  Next.js authed app (reuse React UI)  │
   │  • Landing (what EthioVin does)       │   │  • Garage dashboard (jobs/parts/CRM)  │
   │  • /decode/:vin  free tier (SSR, SEO) │   │  • Insurer intake (claims/police)     │
   │  • Login / Sign-up                    │   │  • Diagnostician inspections          │
   │  • Premium paywall + upgrade          │   │  • super_admin analytics + onboarding │
   └───────────────┬──────────────────────┘   └───────────────────┬───────────────────┘
                   │  HTTPS (session cookie, credentials: include) │
                   ▼                                               ▼
   ┌───────────────────────────────────────────────────────────────────────────────────┐
   │  Express 5 API (cPanel)  —  EXISTING, EXTENDED                                      │
   │  /api/v1/vin   (scan/log/verify/specs …)        ← unchanged                         │
   │  /api/v1/decode  (public free + gated premium)  ← NEW                               │
   │  /api/v1/orgs    (garages/insurers/diag onboarding)  ← NEW                          │
   │  /api/v1/garage  (jobs/appointments/parts/customers)  ← NEW                         │
   │  /api/v1/insurance (claims/police, regulated)   ← NEW                               │
   │  /api/v1/history (vehicle_events read, tiered)  ← NEW                               │
   │  /api/v1/credits (ledger read)                  ← NEW                               │
   │  /api/v1/admin   (analytics, onboarding)        ← EXTENDED                          │
   │  middleware: attachUser, requireRole, NEW requireOrg, NEW requireTier, NEW audit    │
   └───────────────┬───────────────────────────────────────────────────────────────────┘
                   ▼
   ┌───────────────────────────────────────────────────────────────────────────────────┐
   │  Postgres (Drizzle)  —  EXISTING SCHEMA + NEW TABLES                                │
   │  existing: wmi_mapping, nhtsa_models, vehicle_specs, vds_cache, verification_log,   │
   │            vehicle_ledger, user/session/account/verification                        │
   │  NEW: organizations, organization_members, premium_access, payments,               │
   │       vehicle_events, odometer_readings, insurance_claims*, police_reports*,        │
   │       garage_jobs, garage_job_items, appointments, parts, customers,               │
   │       contributor_scores, data_flags, score_adjustments, credit_ledger, audit_log  │
   │  (* = regulated: encryption at rest + row-level access + mandatory audit)           │
   └───────────────────────────────────────────────────────────────────────────────────┘
                   ▲
                   │ external: Gemini (spec drafts), Serper (images), Payment provider (ETB)
```

### 1.2 Coupling & SPOF
- **New coupling:** garage/insurance/diagnostician inputs all couple to `vehicle_events` (the spine)
  and to `contributor_scores` + `credit_ledger`. That coupling is justified — it is the product.
- **SPOF:** the single Postgres (`pool max: 1`) is already the SPOF; M2 multiplies write volume
  (every garage job, every reading). **Finding A1 (below).**

### 1.3 Scaling — what breaks first
- `pool max: 1` serializes all DB work. Fine for a decoder; a garage SaaS with concurrent shops will
  queue. Raise pool size; this is gated by cPanel Postgres connection limits. **Finding A1.**
- `vehicle_events` is the hot, ever-growing table. Needs indexes on `(vin)`, `(vin, event_type)`,
  `(recorded_by)`, `(occurred_at)`, and partitioning consideration at 100x.

### 1.4 Rollback posture
- Each phase ships behind a flag (`feature_flags` config or env). DB migrations are additive
  (new tables only — no destructive change to existing), so rollback = disable flag + `git revert`
  frontend. Regulated tables ship last and isolated.

> **FINDING A1 (Architecture / Scaling) — `pool: max 1` won't carry a garage SaaS.**
> Surfaced for decision below.

---

## 2. Error & Rescue Map (registry)

| Codepath | What can go wrong | Exception | Rescued? | Action | User sees |
|---|---|---|---|---|---|
| `POST /decode` (free) | VIN invalid | `AppError(400)` | Y | reject | "Invalid VIN" |
| `POST /decode` (premium) | user not premium | `AppError(402/403)` | Y | gate | upgrade prompt |
| `GET /history/:vin` | no events | empty result | Y | empty state | "No history yet" |
| payment callback | provider timeout | `TimeoutError` | **GAP** | needs retry+reconcile | hang risk |
| payment callback | duplicate webhook | dup key | **GAP** | needs idempotency key | double credit risk |
| odometer insert | reading < previous | (business rule) | **GAP→flag** | open `data_flag` (rollback) | "under review" |
| garage job close → event | event write fails mid-tx | DB error | Y (tx) | rollback whole close | "couldn't save job" |
| insurance claim read | wrong-org access | `AppError(403)` | Y | deny + **audit** | "Forbidden" |
| trust recompute | concurrent flag updates | race | **GAP** | needs row lock/serializable | wrong score |
| credit award | award + balance race | race | **GAP** | append-only ledger + lock | wrong balance |

**Critical gaps:** payment idempotency, odometer-rollback handling, trust/credit concurrency.
All three are addressed in the schema design (append-only ledgers, idempotency keys, flag state machine)
but must be implemented deliberately, not assumed.

---

## 3. Security & Threat Model

This is the section that matters most, because M2 introduces **regulated, sensitive data**
(insurance claims, police reports, personal/customer info).

| # | Threat | Likelihood | Impact | Mitigation in plan |
|---|---|---|---|---|
| S1 | Insurance/police data over-collection | High | High | **Data minimization**: store only a derived health signal (severity band, incident type, date) — NOT full claim text/PII. Milestone explicitly agrees. |
| S2 | IDOR — user A reads user B's vehicle history / org A reads org B's jobs | High | High | `requireOrg` + `requireTier` middleware; every regulated read scoped by `org_id`/`user_id`; never trust client IDs (matches existing CLAUDE.md rule). |
| S3 | Premium data leak via free endpoint | Med | High | Single server-side tier gate; free and premium are different serializers, never "hide in client". |
| S4 | No audit trail on sensitive reads | High | High | `audit_log` (append-only) on every insurance/police/score/premium-data access. |
| S5 | Encryption at rest for regulated tables | Med | High | App-level encryption (or pgcrypto) for `insurance_claims`/`police_reports` payload columns. |
| S6 | Trust-score gaming (sybil) | Med | Med | Score weighted by corroboration + org verification; new accounts have low weight until verified. |
| S7 | Payment fraud / spoofed callbacks | Med | High | Verify provider signature; idempotency key; reconcile against provider API, never trust the redirect alone. |
| S8 | LLM prompt injection via model/make fields into Gemini | Low | Med | Existing draft flow is admin-gated; keep make/model server-validated (Zod) before prompt interpolation. |

> **"ISO security regulations" reframed:** ISO 27001 is an org certification, not a code gate. The
> concrete, buildable deliverables are: **data minimization (S1), RBAC/scoping (S2/S3), audit logging
> (S4), encryption at rest (S5), and a documented data-retention + access policy.** Those are in scope.
> The certification itself is an org/legal track, out of code scope.

> **FINDING S-LEGAL:** holding insurance-claim and police-report data needs a lawful basis
> (data-sharing agreements with the insurer/police, and user consent). That is a business/legal
> decision, surfaced below.

---

## 3b. The Insurance Data-Exchange Method (resolves DECISION #2)

The insurer relationship is a **reciprocal, barter data exchange** between two organizations, not a
disclosure. Insurer submits claim/police *signals*; in return gets VIN decode + garage data. It is
lawful via a signed data-sharing agreement captured in-system. The method minimizes at BOTH gates so
nothing sensitive crosses in either direction.

```
 INSURER ORG (data_sharing_agreement accepted + scope + date  ← the in-system legal basis)
    │
    │──IN──▶  POST /api/v1/insurance/claim
    │             ▼ INTAKE MINIMIZATION GATE (Zod picks only allowed fields)
    │          KEEP: { vin, incident_type, severity_band 1–5, incident_date, payout_band? }
    │          DROP: claim narrative, claimant PII, amounts, documents (never hit the DB)
    │             ▼ vehicle_event(insurance_claim/police_report) + audit_log + credit(+)
    │          ──▶ feeds vehicle HEALTH GRADE
    │
    │──OUT─◀  GET /decode/:vin (premium) + GET /history/:vin (insurer view)
                  ▼ EGRESS MINIMIZATION GATE ("insurer view" serializer)
               RETURN: decoded identity + specs + HEALTH GRADE + event SUMMARY
               DROP:   garage customer name/phone, raw job notes, other insurers' raw claims
                  ▼ audit_log + credit(−)   ← barter metered via credit ledger
```

**Three mechanisms (all reuse planned machinery):**
1. `data_sharing_agreements` table (org_id, scope jsonb, accepted_by, accepted_at, status, revoked_at) —
   the lawful basis is provable + revocable in-system, gates every IN/OUT call for that org.
2. **Minimize at the door, both ways.** Inbound: the intake Zod schema *picks* only health-signal fields,
   so the raw claim never reaches the DB (nothing sensitive to leak later). Outbound: an "insurer view"
   serializer strips garage customer PII and other insurers' raw data — they get health + decode, not people.
3. The barter is **metered through the `credit_ledger`** (insurer earns on submit, spends on pull) — slots
   into the flag-gated credit infra already decided.

This is the same minimization (S1), audit (S4), and org-scoping (S2) posture as §3 — the exchange just
applies it symmetrically. **No raw PII is stored from insurers, and no garage PII is shared to insurers.**

## 4. Data Flow & Interaction Edge Cases

### 4.1 The contributor-input data flow (the spine)

```
 CONTRIBUTOR (garage/insurer/diagnostician)
   │  submits an input (job done / reading / claim grade)
   ▼
 VALIDATE (Zod) ─▶ [nil? empty? wrong type? VIN bad? over-max?] → 400, no write
   │ ok
   ▼
 RESOLVE VEHICLE (vin → vehicle_ledger / vds_cache)  [unknown VIN? → still record event, identity later]
   │
   ▼
 WRITE vehicle_event (tx) ──┬─▶ CORROBORATION CHECK (does this field conflict with prior entries?)
   │                        │        │ conflict → open/append data_flag (state machine §4.2)
   │                        │        ▼
   │                        └─▶ AWARD CREDIT (trust-weighted) → append credit_ledger
   │                                 │
   ▼                                 ▼
 AUDIT_LOG append                 contributor_scores updated on flag resolution (not on entry)
   │
   ▼
 OUTPUT: event id + credit delta + (if flagged) "under review" status
```

Shadow paths handled: nil/empty → 400; duplicate submit → idempotency key on `(org_id, vin, event_type, occurred_at)`;
upstream (DB) error → whole tx rolls back, no partial credit; unknown VIN → event recorded, identity resolves later.

### 4.2 Trust / fraud corroboration — STATE MACHINE (the dangerous one)

The naive "entry 2 disagrees with entry 1 → punish entry 2" is wrong (punishes the honest correcter).
Correct model: **no entry is authoritative until corroborated.**

```
 field value for a VIN (e.g. color)
        │ first entry
        ▼
   ┌─────────────┐  2nd entry agrees      ┌───────────────┐
   │ UNCORROBOR. │ ─────────────────────▶ │  CORROBORATED │ (value trusted; both contributors fine)
   │  (n=1)      │                        └───────────────┘
   └─────┬───────┘
         │ 2nd entry DISAGREES
         ▼
   ┌─────────────┐   3rd/4th entries break the tie (majority)
   │  CONFLICT   │ ──────────────────────────────┐
   │ (flag open) │                                ▼
   └─────────────┘                    ┌────────────────────────┐
                                      │ RESOLVED: majority wins │
                                      │ minority −score (audited)│
                                      └────────────────────────┘
   Impossible transitions prevented: a score is NEVER reduced while a flag is still CONFLICT
   (only on RESOLVED); a contributor is never penalized for a value that later becomes the majority.
```

`contributor_scores.score` starts at 100.00; `score_adjustments` is the audited delta log;
`data_flags` holds the open conflicts. Score changes are retroactive-safe because they fire on
resolution, not on entry.

### 4.3 Interaction edge cases (garage dashboard, the app-like surface)

| Interaction | Edge case | Handled by |
|---|---|---|
| Job card save | double-click | idempotency + disabled button (existing pattern) |
| Job close → emits event | navigate away mid-close | tx atomic; either fully closed+evented or not |
| Odometer entry | reading lower than last | rollback flag, not a hard reject (could be typo) |
| Claims list | 10k rows | server pagination + index on `(org_id, claim_date)` |
| Premium history | user downgrades mid-session | tier checked server-side per request, not cached in client |

---

## 5. Code Quality — reuse vs new

- **Reuse:** `parseVin`, `decodeVinYear`, two-brain cache, `requireRole`, Zod validators, `VehicleSpecsCard`,
  spec editors. The decode core does not change.
- **New patterns to add once, reuse everywhere:** `requireOrg`, `requireTier`, `audit()` middleware,
  an append-only ledger helper (used by both `credit_ledger` and `score_adjustments`).
- **DRY watch:** free vs premium serialization must be one function with a tier param, not two drifting copies.
- **better-auth org plugin:** prefer better-auth's organization plugin over hand-rolled `organization_members`
  where it fits (garages/insurers are orgs). Evaluate before building custom.

---

## 6. Test Review (new surfaces → required tests)

```
 NEW UX FLOWS:      landing, public decode (free), paywall+upgrade, garage job lifecycle,
                    insurer intake, diagnostician inspection, admin analytics
 NEW DATA FLOWS:    contributor input → event → credit + flag; payment → premium grant
 NEW CODEPATHS:     tier gate, org scope, corroboration state machine, score adjustment, audit
 NEW INTEGRATIONS:  payment provider (ETB), (existing) Gemini/Serper
 NEW ERROR PATHS:   payment idempotency, odometer rollback, trust/credit concurrency
```

Must-have tests (the "ship at 2am Friday" set):
- Tier gate: free request never returns premium fields (unit + integration).
- IDOR: org A cannot read org B's jobs/claims (integration, hostile).
- Corroboration: 1 entry → no penalty; 2 disagree → flag, no penalty; 3rd breaks tie → minority penalized once.
- Credit ledger: concurrent awards never corrupt balance (append-only + lock test).
- Payment: duplicate webhook grants premium exactly once (idempotency test).
- Odometer rollback: lower-than-previous reading raises a flag, not a 500.

---

## 7. Performance

- `pool: max 1` (Finding A1) is the headline.
- Index plan: `vehicle_events(vin)`, `(vin,event_type)`, `(recorded_by)`, `(occurred_at)`;
  `garage_jobs(org_id,status)`; `insurance_claims(org_id,claim_date)`; `credit_ledger(user_id,id)`;
  `data_flags(vin,field,status)`.
- Public `/decode/:vin` is the highest-traffic path → SSG/ISR cache the free tier by VIN; premium is per-user, uncached.
- Credit balance: read from a running `balance_after` column on the latest ledger row, not `SUM()` every read.

---

## 8. Observability

- Structured logs at entry/exit of every new endpoint (request id, user id, org id).
- Metrics day 1: decode count (free vs premium), upgrades, events ingested/day by source, flags opened/resolved,
  credits issued/day, payment success rate.
- Alerts: payment failure rate spike, flag backlog growth, audit-write failures (must never fail silently).
- `audit_log` doubles as the security dashboard source.

---

## 9. Deployment & Rollout

- **Two deploy targets now:** frontend → Vercel/Netlify (Next SSR); API → cPanel (unchanged pipeline).
- Migrations additive only; apply via existing `adjust.sql`/generated migrations (CI still does NOT auto-migrate).
- Feature-flag each phase; regulated tables (insurance/police) ship last, isolated, after the audit+encryption+RLS
  plumbing is proven.
- Post-deploy smoke: public decode renders SSR; login round-trips; a seeded garage job emits an event + credit.

---

## 10. Long-Term Trajectory

- **Reversibility: 4/5.** Backend untouched; frontend re-platform is the one larger bet, but additive (old SPA can
  coexist during cutover). Schema changes are additive.
- **Debt to name now:** existing cleanup backlog in CLAUDE.md (orphaned `vehicle_specs`, no conflict write-path,
  legacy enums) — M2 should fix the conflict write-path because trust/corroboration depends on it.
- **Platform potential:** `vehicle_events` + trust scores become the asset other products (insurer risk-pricing,
  dealer API, mobile scan) build on. That is the moat.

---

## 11. Design & UX

- A **pure design system** (tokens: color, type scale, spacing, radius, elevation, motion) is phase-1 foundation,
  not decoration. Today styling is scattered inline utilities + ad-hoc gradients (`VehicleSpecsCard`, `HistoryPage`).
- Information hierarchy for public decode: VIN → make/model/year (free) → "unlock full history" (premium) → trust badges.
- State coverage required for every new screen: LOADING / EMPTY / ERROR / SUCCESS / PARTIAL.
- Recommend running `/plan-design-review` on phase 1+2 before building the funnel.

---

## NOT in scope (explicitly deferred)
- ISO 27001 *certification* (org/legal track, not code).
- Mobile app / camera-OCR VIN scan (great phase-9, deferred).
- Public dealer API / embeddable widget (platform play, after history fills).
- Japan chassis decoding (still unimplemented from M1; unrelated to M2).
- Insurer risk-pricing product (depends on a full history corpus; later).

## What already exists (reused, not rebuilt)
- VIN parse + year decode, two-brain cache, better-auth + roles, Zod validation, Gemini/Serper, `VehicleSpecsCard`
  and spec editors, the existing `verification_log` (extend for trust corroboration).

## Dream-state delta
This plan moves EthioVin from "admin-only VIN decoder" to "public funnel + trust-scored contributor network with a
credit economy." It reaches the 12-month ideal **only if sequenced** — funnel first, contributor pipeline second,
regulated/insurance last. Built all-at-once it reaches none of it.

---

## Failure Modes Registry

| Codepath | Failure mode | Rescued? | Test? | User sees | Logged? |
|---|---|---|---|---|---|
| payment callback | provider timeout | **N→fix** | must | hang | must |
| payment callback | duplicate webhook | **N→fix** | must | double credit | must |
| odometer insert | rollback (lower reading) | flag | must | "under review" | yes |
| trust recompute | concurrent flag race | **N→fix** | must | wrong score | yes |
| credit award | balance race | **N→fix** | must | wrong balance | yes |
| insurance read | cross-org IDOR | Y | must | "Forbidden" | **must (audit)** |

Any **N→fix** row is a P1 implementation task (see below). None may ship silent.

---

## Implementation Tasks (synthesized from findings)

- [ ] **T1 (P1)** — DB — add M2 tables (orgs, members, premium_access, payments, vehicle_events, odometer_readings, insurance_claims*, police_reports*, garage_jobs, garage_job_items, appointments, parts, customers, contributor_scores, data_flags, score_adjustments, credit_ledger, audit_log, data_sharing_agreements). Additive migration. Verify: `db:generate` + `db:push` clean.
- [ ] **T2 (P1)** — middleware — add `requireOrg`, `requireTier`, `audit()`; reuse `requireRole`. Verify: IDOR + tier integration tests pass.
- [ ] **T3 (P1)** — design system — token layer (color/type/space/radius/elevation/motion) + base components. Verify: design-review on funnel.
- [ ] **T4 (P1)** — frontend — Next.js shell, public/authed routing, SSR public `/decode/:vin`, login, paywall. Verify: SSR renders, refresh/share works (fixes the nav-state gap).
- [ ] **T5 (P1)** — decode — split serializer into free vs premium (one function, tier param). Verify: free response never contains premium fields.
- [ ] **T6 (P1)** — trust — corroboration state machine + `data_flags` + `score_adjustments`; score changes only on resolution. Verify: 1/2/3-entry test suite.
- [ ] **T7 (P1)** — credits — append-only `credit_ledger` with running balance + lock, built as **neutral infrastructure**. Redemption rule (closed-loop / cash-out / status-only) lives behind a `CREDIT_REDEMPTION_MODE` config flag, decided after phase 3. Earn/spend events are recorded regardless. Verify: concurrent-award test; redemption gated by flag.
- [ ] **T8 (P1)** — payments — provider integration (ETB) with signature verify + idempotency + reconcile. Verify: duplicate-webhook test grants premium once.
- [ ] **T9 (P1)** — garage — jobs/appointments/parts/customers; job close emits `vehicle_event`. Verify: close → event + credit atomic.
- [ ] **T10 (P1)** — insurance — reciprocal exchange (§3b): `data_sharing_agreements` gate, intake minimization (Zod picks only health-signal fields, raw claim never persisted), "insurer view" egress serializer (strips garage PII), barter metered via credit ledger; encryption at rest + RLS + mandatory audit on both gates. Verify: cross-org denied + audited; raw claim PII never stored; garage PII never returned to insurer.
- [ ] **T11 (P2)** — admin — analytics dashboards + org onboarding. Verify: super_admin-only.
- [ ] **T12 (P2)** — perf — raise `pool: max`, add the index set, SSG/ISR free decode. Verify: load test.
- [ ] **T13 (P2)** — fix M1 conflict write-path (trust corroboration depends on it). Verify: differing proposal flags `conflict`.

---

## DECISIONS NEEDED (business/legal — cannot be defaulted)

1. **Monetization + credit redemption (keystone).** ✅ **DECIDED 2026-06-23:** build the credit
   ledger + trust engine as neutral infrastructure now; redemption rule (closed-loop vs cash-out vs
   status-only) deferred behind a `CREDIT_REDEMPTION_MODE` config flag, to be chosen after phase 3
   when real contribution volume is visible. No reward *loop* launches until then; the *infrastructure*
   is built regardless.
2. **Insurance/police lawful basis.** ✅ **DECIDED 2026-06-23:** lawful via a **reciprocal data-sharing
   agreement** — insurer submits minimized claim/police signals, receives VIN decode + PII-stripped garage
   data in return. Method designed in §3b (minimize at both gates, `data_sharing_agreements` table as the
   in-system basis, barter metered via credit ledger). No raw insurer PII stored; no garage PII shared out.
3. **Garage-management depth.** Minimum (job cards + history emit) vs full (appointments, parts/inventory,
   invoicing, customer CRM). Affects phase-4 effort materially.
4. **Trust penalty curve.** Default proposed: confirm a value at 2 agreeing entries; on conflict, resolve at
   3–4 entries by majority; minority −5 to −15 per confirmed bad entry, floored; repeat offenders escalate.
   Confirm or adjust.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | issues_open | mode: HOLD_SCOPE, 6 critical gaps (payment idempotency, odo rollback, trust race, credit race, IDOR audit, pool:1) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | not yet run |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | not yet run |

- **VERDICT:** CEO review complete (HOLD SCOPE). Eng review required before implementation; design review recommended for phases 1–2 (funnel).

Resolved 2026-06-23: (a) monetization — credit/trust infra now, redemption deferred behind `CREDIT_REDEMPTION_MODE` flag; (b) insurance lawful basis — reciprocal data-sharing exchange, method in §3b.

**UNRESOLVED DECISIONS:**
- Garage-management depth: minimum vs full (scope — needed before phase 4)
- Trust penalty curve (confirm or adjust the proposed default)
