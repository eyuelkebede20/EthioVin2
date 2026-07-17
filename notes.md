# notes.md — working notes

Freeform working notes for the current effort (public site + API launch prep).
Formal docs live in `CLAUDE.md` / `claude.milestone*.md` / `API_REFERENCE.md`;
the build journal is `tasks.md`. This file is scratch/decisions.

## 2026-07-16 — public landing page + client-only deploy

**Why:** `ethiovin.senaycreatives.com` (the `client/` Vite SPA at `/public_html/ethiovin/`)
dropped every visitor straight onto a bare login form. Goal: a public page that explains the
product, Ethiopia-focused, before asking anyone to sign in.

**What shipped (client/, live via `deploy-client.yml`):**
- `pages/LandingPage.tsx` — public landing at `/`. Sections: hero (Ethiopia import-fleet angle) +
  inline SVG car with an animated VIN-scan bar, import-origin flag strip (from `IMPORT_COUNTRIES`),
  a 4-step "How it works" process, "what you get" + a mock decoded-profile card, "who it's for",
  a **Developers** section (curl `POST /v1/decode` sample + portal/docs links), final CTA, footer.
- `App.tsx` — router always mounted; `/` public, `/login` for the form, app routes auth-guarded.
- `LoginPage.tsx` — "← Back to home" link; post-login redirect → `/scan`.
- All car imagery is **inline SVG / emoji** — no external image hosts (avoids broken hotlinks +
  keeps the build self-contained). If we want real photos later, drop them in `client/public/`
  and swap `CarHero`/`CarProfileCard`.

**Deploy mechanism:** the main `deploy.yml` is `main`-only and deploys client + web + backend in
ONE job (no path filters). Merging to `main` now would push the un-migrated M2/M3 backend to prod
(L1 `m3.sql` + L2 Chapa env not done) → risky. So added `deploy-client.yml`: FTPs only
`client/dist` → `/public_html/ethiovin/`, triggered by `client/**` pushes to `milestone-2`.
⚠️ Side effect: every future `client/**` push to `milestone-2` auto-deploys to prod. Switch to
`workflow_dispatch`-only if that's unwanted.

## Open decisions / known gaps

- **Developer flow isn't fully live.** The landing's Developers section USED to link to
  `https://ethiovinapi.senaycreatives.com/developers` (+ `/docs`) — but that's the **Express API
  host**, which serves JSON only, so those Next portal routes 404'd there (`{"error":"Not found"}`).
  **Fixed 2026-07-18:** `LandingPage.DEV_PORTAL_URL` is now empty → the section shows a "Developer
  API — launching soon" pill instead of dead links. The `web/` portal (real `/developers`,
  `/developers/docs`, `/dashboard/api`) still isn't deployed/domain-mapped, and it will live on its
  OWN origin (never the API host). **To re-enable:** deploy `web/`, map a subdomain (e.g.
  `developers.senaycreatives.com`), then set `DEV_PORTAL_URL` to that origin.
- The `curl` sample uses the API domain `ethiovinapi.senaycreatives.com/v1/decode` — correct once
  the M3 backend is deployed (kept as-is).

## 2026-07-16 — review fix: smoke script invalid-VIN contract

Self-review of `scripts/smoke-v1.mjs` caught a wrong assertion: it expected a malformed
VIN to return `200 { valid:false, charged:0 }`. The real `/v1/decode` contract (controller
`publicApiController.ts` + `API_REFERENCE.md`) is:
- **Malformed VIN** (not 17 clean chars) → `422 invalid_vin` (public error envelope), free.
- **Well-formed but unknown VIN** → `200 match:"none", charged:0` (free) — this is the
  "never charge for we-don't-know" path. There is no `valid:false` shape; `valid` is always true.

Fixed: split into two checks (422 malformed + 200 match:none unknown), added `UNKNOWN_VIN`
env (default `ZZZ1234567ZZZ9999`). Docs were already correct — only the script was wrong.

## Launch path (see `tasks.md` → "M3 LAUNCH plan")

L1 apply `m3.sql` on prod → L2 set Chapa env → L3 pin Passenger to 1 instance (in-memory limiters,
shared-hosting choice) → L4 merge `milestone-2` → `main` (full deploy) → L5 `npm run smoke` +
`RUN_DB_TESTS=1 npm test` → L6 real Chapa test payment → L7 cron `logs:prune` + seed promo →
L8 `POST /v1/decode/batch` — DONE 2026-07-17 (implemented; was a 501 stub).
