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

## Not in scope (deferred, per the plan)
Mobile/OCR scan, public dealer API, insurer risk-pricing product, ISO 27001 certification, Japan
chassis decoding.
