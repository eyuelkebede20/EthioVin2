# CLAUDE.md — EthioVin

VIN decoder for cars imported to Ethiopia. Decodes WMI/VDS from a VIN, serves cached
specs when the (make+hardware) is already known, and falls back to an admin verification
flow (Gemini spec draft + Serper image search) for unknown vehicles. The verified result
is cached so future cars of the same model decode instantly — the "self-improving" core.

## Documentation map (where to look)

This file (`CLAUDE.md`) is the lean, stable source of truth — core conventions + the M1 decoder.
Working detail lives in dedicated chapters so this file stays uncluttered:

| Doc | What's in it |
|-----|--------------|
| `CLAUDE.md` (this) | Core conventions, VIN parsing rules, the cache model, auth, M1 API surface. Read first. |
| `claude.milestone2.md` | **M2 detail** — new tables/middleware/services/routes, the `web/` Next.js app + design system, stubs/handoffs. Read before touching M2 code. |
| `MILESTONE_2_PLAN.md` | The M2 CEO plan + 11-section review (architecture, security, sequencing, failure registry). |
| `claude.report.md` | M2 progress report — what shipped, what's stubbed, the handoffs. |
| `claude.milestone3.md` | **M3 detail** — the public API platform: API keys, credit metering, Chapa billing, promo codes, the `/v1` contract, landing page + developer dashboard. Read before touching M3 code. |
| `API_REFERENCE.md` | The public, developer-facing `/v1` contract (auth, endpoints, errors, credits). Single source for the portal docs page — change it before changing `/v1` code. |
| `tasks.md` | Claude's working build journal / task notes (per-iteration progress, gotchas). Not formal docs. |
| `web/DESIGN.md` | The `web/` design-system token reference. |

Future milestones follow the same pattern: detail in `claude.milestone<N>.md`, a pointer here.

## Repository layout (monorepo)

This is a **two-package monorepo**, NOT a single app. Paths below are relative to the repo root.

- `backend/` — Express 5 API (Node 22, ESM, Drizzle + Postgres, better-auth)
- `client/` — React 19 + Vite SPA (React Router 7, Tailwind 3 + daisyUI 4, better-auth client)
- `.github/workflows/deploy.yml` — CI: builds both, FTP-deploys to cPanel on push to `main`
- `zipit.ps1` — local helper to zip the project

There is **no root `package.json`** — run `npm` commands inside `backend/`, `client/`, or `web/`.

**Node 22+ is required across all packages** (host + CI run Node 22). Some deps now enforce it via
`engines` (e.g. the legacy `client/` Kysely bump → `node >= 22`), so Node 20 will warn or fail to install.

---

## Backend

### Stack

- **Runtime:** Node 22, `tsx watch` for dev. Prod runs bundled plain JS (`node dist/index.js`).
- **Framework:** Express 5 (note: Express 5 auto-forwards rejected promises to the error handler — controllers can be `async` and `throw`).
- **DB:** PostgreSQL via Drizzle ORM (`postgres-js` driver, pool `max: 1`). `drizzle-kit` for migrations.
- **Auth:** better-auth (email/password + `admin()` plugin).
- **External:** Google GenAI `@google/genai` (Gemini 2.5 Flash) for spec drafts; Serper (`google.serper.dev/images`) for image search.
- **Validation:** Zod 4 (all request bodies parsed through `src/utils/validation.ts`).
- **Rate limiting:** `express-rate-limit`.
- **Module system:** ESM (`"type": "module"`). Imports MUST include the `.ts` extension
  (e.g. `import { auth } from "./auth.ts"`). Dropping it breaks resolution.

### Project layout (`backend/src/`)

- `index.ts` — app entry: CORS, rate limiters, better-auth handler, `attachUser`, route mounts, 404 + error handler.
- `auth.ts` — better-auth config (drizzle adapter, `additionalFields.role`, `admin()` plugin).
- `db/`
  - `schema.ts` — Drizzle schema (source of truth for tables).
  - `index.ts` — `db` client (postgres-js).
  - `migrate.ts` — applies generated migrations (`node-postgres` migrator; `npm run db:migrate`).
  - `seed.ts` — seeds `wmi_mapping` + fetches NHTSA models for ~27 makes (`npm run db:seed`).
  - `migrations/` — generated SQL + `meta/` journal. `0003_*.sql` is the full **M2** additive schema
    (all ~20 tables/enums/FKs/indexes). ⚠️ The `0000`–`0002` `.sql` files were never committed (only
    their snapshots are), so `npm run db:migrate` can't replay history — apply via the SQL files below.
  - `setup.sql` — full `pg_dump` of the schema (bootstrap a fresh DB by hand). **M1-era; stale for M2.**
  - `adjust.sql` — **idempotent** M1 adjustment (columns/indexes/FK; does not create tables).
  - `m2.sql` — **idempotent** M2 bootstrap (`CREATE TABLE/INDEX IF NOT EXISTS`, guarded enums + FKs).
    Safe to run against prod regardless of whether a dev `db:push` already created some tables:
    `psql "$DATABASE_URL" -f src/db/m2.sql`. This is the recommended way to apply M2 to an existing DB.
- `controllers/` — `vinController.ts` (scan/log/verify/specs/conflicts/resolve/draft/images), `adminController.ts` (WMI management).
- `routes/` — `vinRoutes.ts` (`/api/v1/vin/*`), `adminRoutes.ts` (`/api/v1/admin/*`).
- `middleware/`
  - `authMiddleware.ts` — `attachUser`, `requireAuth`, `requireRole`.
  - `errorHandler.ts` — `AppError` class, `notFound`, central `errorHandler` (handles `ZodError` → 400, `AppError` → its status, else 500; never leaks stack traces).
- `services/aiService.ts` — Gemini draft generation (structured `responseSchema`, 503 retry loop, safe-defaults merge).
- `utils/`
  - `vin.ts` — `parseVin()`: the canonical VIN parser (see below).
  - `decodeVinYear.ts` — `decodeVinYear()`: model-year decode (position 10 + position 7 cycle).
  - `validation.ts` — all Zod request schemas + reusable field validators.

### Commands (run inside `backend/`)

- `npm run dev` — start dev server (`tsx watch`).
- `npm run db:generate` — generate a migration from schema changes.
- `npm run db:push` — push schema straight to the DB (dev convenience).
- `npm run db:migrate` — apply generated migration files.
- `npm run db:seed` — seed WMIs + NHTSA models.
- `npm run db:studio` — Drizzle Studio.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — esbuild bundle to `dist/index.js` (used by CI/prod).
- `npm start` — `node dist/index.js` (prod).

After ANY change to `src/db/schema.ts`, run `db:generate` then `db:push` (dev) before testing.
For an existing/production DB, prefer the idempotent `adjust.sql` or generated migrations.

### Environment variables (`backend/.env`)

- `DATABASE_URL` — Postgres connection string (required; throws at boot if missing).
- `BETTER_AUTH_URL` — better-auth base URL.
- `BETTER_AUTH_SECRET` — better-auth signing secret.
- `GEMINI_API_KEY` — Google GenAI key (spec drafts).
- `SERPER_API_KEY` — Serper key (image search).
- `FRONTEND_URL` — comma-separated allowed CORS origins / better-auth trusted origins (required; throws at boot if empty). Trailing slashes are stripped before matching.
- `PORT` — server port (default 3000).

M3 (the public API platform) adds Chapa + public-URL vars — see `claude.milestone3.md` §11.

---

## VIN parsing — THE most important convention

A VIN is 17 chars. Positions are 1-indexed in spec language but 0-indexed in JS strings.
**`parseVin()` in `utils/vin.ts` is the single source of truth — always derive on the SERVER.**
The ONLY correct slices in this codebase:

```ts
wmi      = vin.substring(0, 3);  // positions 1–3  → 3 chars
vds_code = vin.substring(3, 8);  // positions 4–8  → 5 chars (NOT the check digit)
vis      = vin.substring(9);     // positions 10–17
plant    = vin.substring(10, 11);// position 11
year     = decodeVinYear(vin);   // position 10 (+ position 7 to pick the 30-yr cycle)
```

- `vds_code` is **5 characters**, sliced `(3, 8)`. Never `(4, 8)` (that's 4 chars and skips
  position 4) — that off-by-one was a real bug that produced shifted keys like `LCC`/`E4CB7`
  instead of `LCO`/`CE4CB`. The schema column is `varchar(5)`, `vdsField` validates 5 chars,
  and `submitVerifiedSpec` validates `length === 5`; keep all of them in agreement.
- **Derive wmi/vds on the SERVER from the VIN — never trust client-sent values for the
  cache key.** `processVin` and `saveVehicleToLedger` both call `parseVin(body.vin)`. The
  frontend must display/submit `extractedData.wmi` / `extractedData.vds_code` from the
  `/scan` response, not re-slice the VIN in the browser, or the displayed key, the saved
  key, and the lookup key can drift apart.
- **`parseVin` does NOT strip I/O/Q.** These imported VINs legitimately contain `O`
  (e.g. `LCO…`); removing it would shift every position left and mis-read the year
  (position 10) as e.g. 2004 instead of 2025. `parseVin` only uppercases and drops
  non-alphanumerics. The client `Scanner` mirrors this (keeps I/O/Q for the ASEAN region).
  ⚠️ There is deliberately **no shared "VIN field" Zod validator** — a generic refine that
  strips or rejects I/O/Q would shift positions and break the year decode. `scanSchema` and
  `saveLedgerSchema` take a plain bounded `z.string()` and defer to `parseVin`. (A `vinField`
  that wrongly rejected I/O/Q used to live in `validation.ts`; it was removed.)
- `decodeVinYear` uses position 7 (index 6): a letter → 2010+ cycle, a digit → 1980–2009.
  Many imports are pre-2010; without this, old cars decode as recent. It also guards against
  future years (subtracts 30 if the result is beyond next year) and tolerates 17/18-char input.
- **Year is always treated as a heuristic.** Both the verification form and the cache-record
  flow let the user override the decoded year; the per-VIN year is stored on `vehicle_ledger`,
  never shared via the cache.

## The cache model (the "two-brain" / self-improving core)

Two stores work together:

- **Brain 1 — `vehicle_ledger`:** the exact, per-VIN identity record (one row per scanned VIN,
  unique on `vin`). Holds make/model/year/image + decoded wmi/vds/vis/plant/country + a copy of
  `hardware_specs`, and `scannedBy` (FK → `user.id`).
- **Brain 2 — `vds_cache` + `vehicle_specs`:** the shared "DNA". `vds_cache` is keyed on
  `(wmi, vds_code)` (composite PK, exact 5-char match, NO wildcards) and points at a
  `vehicle_specs` row holding the `hardware_specs` jsonb blob. Same model + different VIS
  (positions 11–17) share a key and hit the cache. Different VDS = different model = correctly a miss.

Rules:

- `vds_cache.wmi` has an FK to `wmi_mapping.wmi`. **You must seed the parent WMI row before
  inserting the cache row**, or you get FK error 23503. Both `saveVehicleToLedger` and
  `submitVerifiedSpec` upsert `wmi_mapping` (as `"Unknown"` if not known) before the cache
  insert. `saveVehicleToLedger` upserts the *real* make but only over an existing `"Unknown"`
  (`setWhere: eq(manufacturer, "Unknown")`) so it never clobbers a known make.
- Unknown WMIs surface to admins via `getUnknownWMIs` (`manufacturer = 'Unknown'`).
- `updateWMI` only UPDATEs; it cannot create a WMI. New WMIs must be seeded by the save path.
- On a cache hit, `processVin` enriches the response with a **sibling ledger row** (any recorded
  VIN of the same `(wmi, vds)`) to recover make/model/image — preferring a sibling that actually
  has an image, then the most recent. The cache row itself has no make/model/image.
- Editing shared specs (`updateSpecs`, `PATCH /specs`) updates the `vehicle_specs` blob in place
  AND every `vehicle_ledger` row of that `(wmi, vds)` — because specs are shared across the model.

## `/scan` response shapes (frontend must branch on these)

Three distinct shapes from `processVin`:

1. **Exact VIN in ledger:** `{ hit: true, patientExists: true, data: <vehicle_ledger row> }`
   — specs at `data.hardware_specs`. Frontend routes straight to the detail page.
2. **Cache hit (same wmi+vds, new VIN):** `{ hit: true, patientExists: false, extractedData,
   reference, data }` — specs flattened to `data.hardware_specs`; `reference` is the sibling
   `{ manufacturer, model, year, image_url }` (or `null`). Identity (make/model/image) comes
   from `reference`/`extractedData`, NOT the cache `data` row. Year stays per-VIN. Frontend
   shows the full car with a "Record this VIN" action.
3. **Miss:** `{ hit: false, patientExists: false, promptAdmin: true, extractedData,
   suggestedModels }` — show the verification form. `suggestedModels` is populated from
   `nhtsa_models` (case-insensitive match on the predicted make) only when the WMI is known.

Frontend render rule: `hit` → show specs/car; else `promptAdmin` → show form. Don't branch on
the presence of `hardware_specs` or on `suggestedModels`.

⚠️ These shapes are **internal-only**. The public M3 `/v1/decode` endpoint has its own flat,
versioned envelope (`API_REFERENCE.md`) — never leak `hit`/`patientExists`/`promptAdmin` there.

## Backend API surface

All app routes live under `/api/v1` and are gated by **our own** middleware (better-auth only
guards `/api/auth/*`). Roles allowed are in parentheses. (M3 adds the keyed public surface at
`/v1` — the one deliberate exception to the `/api/*` rule; see the Milestone 3 section.)

**Public (no auth):**

- `GET /health` — liveness/readiness probe (`{ status: "ok" }`); un-throttled, for the host/CI monitor.

**`/api/v1/vin`** (`vinRoutes.ts`):

- `POST /scan` — decode a VIN (`requireAuth` — any logged-in user).
- `POST /verify` — submit verified specs for `(wmi, vds_code)`; logs to `verification_log`, upserts cache (super_admin, garage_admin, diagnostician).
- `POST /log` — save a verified vehicle to the ledger AND seed the shared cache (super_admin, garage_admin, diagnostician).
- `PATCH /ledger/:vin` — edit one ledger row's identity fields (make/model/year/image); leaves cache key + shared specs untouched (super_admin, garage_admin, diagnostician).
- `PATCH /specs` — edit the SHARED specs for a `(wmi, vds_code)`; updates the cached blob and every ledger row of that model (super_admin, garage_admin, diagnostician).
- `GET /conflicts` — cache rows flagged `status = 'conflict'`, joined with their proposals (super_admin).
- `POST /resolve` — pick the winning `spec_id` for a conflicting key; only a spec actually proposed for that key is accepted (super_admin).
- `POST /generate-draft` — AI-drafted specs for a make/model/year (super_admin, garage_admin, diagnostician; extra `externalApiLimiter`).
- `POST /images` — proxy a Serper image search (super_admin, garage_admin, diagnostician; extra `externalApiLimiter`). Client sends a 1-based `startIndex`; server returns a 4-image slice.

**`/api/v1/admin`** (`adminRoutes.ts`, whole router gated `requireRole("super_admin", "garage_admin")` at mount, individual routes super_admin):

- `GET /wmi/unknown` — WMIs with `manufacturer = 'Unknown'`.
- `PUT /wmi/update` — attribute a make (+ optional country) to an existing WMI (404 if it doesn't exist).
- `GET /wmi/manufacturers` — distinct known manufacturers (excludes Unknown/blank), for select menus.

### Security headers, rate limiting & request hardening (`index.ts`)

- `helmet()` — sets HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy`,
  etc. Configured for a cross-origin JSON API: `contentSecurityPolicy: false` (we serve no HTML)
  and `crossOriginResourcePolicy: { policy: "cross-origin" }` (the frontend is on a different
  origin). Keep these two relaxed or cross-origin browser use breaks.
- `app.disable("x-powered-by")` — don't advertise the framework.
- `app.set("trust proxy", 1)` — one proxy hop (cPanel/LiteSpeed) so `req.ip` is the real client; without it `express-rate-limit` throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.
- `authLimiter` — 20 req / 15 min on `/api/auth/sign-in` + `/api/auth/sign-up` (blunts credential stuffing; deliberately NOT on get-session).
- `apiLimiter` — 100 req / 15 min on `/api/v1/vin/*`.
- `externalApiLimiter` — 30 req / 15 min on the paid Gemini/Serper routes (`generate-draft`, `images`).
- `express.json({ limit: "100kb" })`; the better-auth raw-body handler runs BEFORE `express.json()`.
  The auth handler matches `req.url === "/api/auth"` or the `"/api/auth/"` prefix (not a bare
  `startsWith("/api/auth")`, which would also catch unrelated paths like `/api/auth-status`).
  (M3 adds a second raw-body route registered the same way: the Chapa webhook — see
  `claude.milestone3.md` §7.)

### Dependency / vulnerability posture

- Keep `npm audit` clean on **production** deps. Run `npm audit fix` (without `--force`) after
  dependency changes in both `backend/` and `client/`.
- `npm audit fix --force` is NOT applied automatically: in `backend/` it would bump
  `better-auth`/`drizzle-kit` across majors. The only vulns it would clear are in the
  `esbuild`→`drizzle-kit` chain, which is **build-time tooling** (dev), not the production
  runtime — so it's an opt-in upgrade, not an emergency.

---

## Auth conventions (where most bugs came from)

- **better-auth only guards `/api/auth/*`.** It does NOT protect `/api/v1/*` — those use our
  own middleware. Always gate app routes explicitly.
- **Identity comes from the session, never a header.** `attachUser` resolves the session once and
  hangs `req.user` on the request. Read `req.user.id`. Never read `req.headers["x-user-id"]` and
  never put `x-user-id` in CORS `allowedHeaders` — it's client-spoofable (allowed headers are only
  `Content-Type`, `Authorization`).
- **`requireRole` takes SPREAD string args, not an array:**
  ```ts
  router.post("/verify", requireRole("super_admin", "garage_admin"), handler); // ✅
  router.post("/verify", requireRole(["super_admin"]), handler); // ❌ always 403
  ```
  An array as a single arg never matches `roles.includes(req.user.role)`. This caused
  repeated phantom 403s.
- **Don't stack `requireRole` and `requireAuth` on the same route** — `requireRole` already
  rejects unauthenticated users (401). Use `requireAuth` alone for any-logged-in-user routes,
  `requireRole(...)` alone for role-restricted ones.
- Custom roles must be surfaced to the session via `auth.ts`:
  ```ts
  user: { additionalFields: { role: { type: "string", input: false } } }
  ```
  Without this, `req.user.role` is undefined → 403 even for a real super_admin.
- Don't pass custom role names to the `admin()` plugin's `adminRoles` — it only accepts roles
  defined in its own `roles` config and throws at boot otherwise. Our middleware handles
  authorization; the plugin is just for user management (ban/impersonate).
- Roles (`userRoleEnum`): `super_admin`, `garage_admin`, `diagnostician`, `insurance`, `user`.
  New signups default to `user`. Promote via SQL:
  `UPDATE "user" SET role = 'super_admin' WHERE email = ?`.
- **Two distinct frontend role gates — don't conflate them:**
  - The **`/admin` dashboard** (route + nav link in `App.tsx` / `Navbar.tsx`) is `super_admin` only.
  - The **scan/record/edit write actions** (VerificationForm, "Record this VIN", Edit, Edit Specs)
    gate on the broader `canVerify(role)` set (`super_admin`/`garage_admin`/`diagnostician`) via
    `lib/roles.ts`. Read-only roles (`user`/`insurance`) still scan and view cached specs, but get
    `UnknownVehicleNotice` on a miss and a read-only detail page — never a form that would 403.
  - `canVerify`'s role list MUST mirror the backend gates in `vinRoutes.ts`; if you change one,
    change both.
- **M3 adds a second, disjoint identity channel:** API keys for `/v1` (hashed, resolved by
  `requireApiKey`, identity = `req.apiKey.ownerId`). `/v1` never reads sessions; `/api/v1/dev/*`
  never accepts API keys. Detail in `claude.milestone3.md` §4–§5.

---

## Frontend (`client/`)

### Stack

- React 19, Vite 8, TypeScript, React Router 7 (`BrowserRouter`).
- Tailwind 3 + daisyUI 4 (warm orange/amber theme), `lucide-react` icons.
- better-auth React client (`better-auth/react` + `adminClient()` plugin) for session/sign-in/up/out.
- `VITE_BACKEND_URL` env (set at build time; CI injects the prod API URL).

### Commands (run inside `client/`)

- `npm run dev` — Vite dev server.
- `npm run build` — `tsc -b && vite build`.
- `npm run lint` — ESLint.
- `npm run preview` — preview the production build.

### Layout (`client/src/`)

- `main.tsx` / `App.tsx` — root + routing. The router is ALWAYS mounted (public + app routes).
  Routes: `/` → **public `LandingPage`** (signed-in users redirect to `/scan`); `/login`
  (`LoginPage`; signed-in → `/scan`); `/scan` (`ScannerPage`), `/history/:vin` (`HistoryPage`),
  `/admin` (`AdminDashboard`, super_admin) are **auth-guarded** (signed-out → `/login`); `*` →
  `/` when signed out, `/scan` when signed in. (Was previously "render `LoginPage` if signed out";
  changed so the marketing site at `ethiovin.senaycreatives.com` explains the product first.)
- `lib/auth-client.ts` — better-auth client instance.
- `lib/constants.ts` — `IMPORT_COUNTRIES`, `DEFAULT_MANUFACTURERS` (UI fallback lists).
- `lib/roles.ts` — `VERIFIER_ROLES` + `canVerify(role)`: the client-side "who can write" check
  (`super_admin`/`garage_admin`/`diagnostician`). **Must stay in sync with the backend route
  gates** in `vinRoutes.ts`; it only decides what UI to show — the server is the real authority.
- `api/`
  - `client.ts` — `api<T>()` fetch wrapper: always sends the session cookie
    (`credentials: "include"`), JSON-encodes the body, throws `ApiError(status, message)` on non-2xx.
  - `vinService.ts` — typed wrappers + the response interfaces (`ScanResponse` union: `ScanLedgerHit | ScanCacheHit | ScanMiss`).
  - `adminService.ts` — WMI admin calls.
- `pages/`
  - `LandingPage.tsx` — public marketing/landing page at `/` (Ethiopia-focused: import origins,
    common makes, the 4-step decode process, a Developers section + `curl` sample, inline SVG car
    art — no external image assets). Routes to `/login`. First thing a signed-out visitor sees.
  - `LoginPage.tsx` — combined sign-in / sign-up (min 8-char password; redirects to `/scan` on
    success; has a "← Back to home" link to `/`).
  - `ScannerPage.tsx` — owns scan state; routes ledger hits to the detail page, cache hits to a
    "record this VIN" detail view. On a **miss it branches by role** (`canVerify`): verifier roles
    get the full `VerificationForm`; read-only roles (`user`/`insurance`) get `UnknownVehicleNotice`
    instead (no admin form whose actions would 403). Accepts a one-shot `resumeScan` nav-state so
    the detail page can bounce a verifier back to the full form.
  - `HistoryPage.tsx` — vehicle detail. Shows decoded identity + shared specs to everyone. The
    mutating actions — Edit identity (`updateLedger`), Edit shared specs (`updateSpecs`), and
    "Record this VIN" (`saveToLedger`) — are **gated on `canVerify`**, so read-only roles see a
    clean read-only view. Reads everything from nav state (no fetch-by-VIN; shows a "no data in
    memory" fallback if navigated to directly).
  - `AdminDashboard.tsx` — super-admin page: `WMIResolutionPanel` + `ConflictsPanel`.
- `components/`
  - `Scanner.tsx` — VIN input. ASEAN (17-digit) vs Japan (chassis) region toggle; **Japan decoding
    is not implemented on the backend** (shows a "not yet implemented" message). Keeps I/O/Q, caps at 17.
  - `VerificationForm.tsx` — the miss/cache-hit flow: pick make (with inline "Unknown WMI"
    resolution + add-manufacturer modal), model, year; "Generate Specs Draft (AI)" (calls
    `generate-draft` + `images` in parallel), image picker, editable spec sections, save.
  - `UnknownVehicleNotice.tsx` — read-only "not in our records yet" screen for non-verifier roles
    on a scan miss: shows the decoded basics (VIN, estimated make/year, WMI, VDS) + a "scan another"
    button. No form, no AI, no save.
  - `VehicleSpecsCard.tsx` — read-only spec display; per-section icon/gradient styling keyed on
    the lower-cased section name, with a default style for unknown sections.
  - `SpecEditor.tsx` — generic editor for the `hardware_specs` blob (sections of primitive fields);
    `humanize()`s keys, infers input type from the value.
  - `Navbar.tsx` — logo, admin-only Scanner/Dashboard tabs, role chip, logout.
  - `ui/Banner.tsx` — inline status banner (`error`/`success`/`info`) used instead of `alert()`.
- `public/.htaccess` — SPA fallback rewrite (so refreshing `/scan` doesn't 404 on Apache).
- `public/` also has `favicon.svg`, `icons.svg`.

### Frontend env (`client/.env`)

- `VITE_BACKEND_URL` — backend base URL (baked into the build).

---

## Data model (`backend/src/db/schema.ts`)

- **Enums:** `statusEnum` (`pending`/`verified`/`rejected`/`conflict`), `userRoleEnum`, plus
  `fuelEnum`/`transEnum`/`bodyStyleEnum` (legacy leftovers — specs are a jsonb blob now, not flat columns).
- `wmi_mapping` — `wmi` (PK, 3), `manufacturer` (default `"Unknown"`), `country`, `updated_at`.
- `nhtsa_models` — `id`, `make`, `model`; index on `make` (the NHTSA fallback queries by make).
- `vehicle_specs` — `id`, `hardware_specs` jsonb (the shared blob, "Brain 2").
- `vds_cache` — composite PK `(wmi, vds_code)`; `wmi` FK → `wmi_mapping.wmi`; `spec_id` FK →
  `vehicle_specs.id`; `status`; timestamps. (No separate search index — the PK already covers it.)
- `verification_log` — `id`, `wmi`, `vds_code`, `proposed_spec_id` FK → `vehicle_specs.id`,
  `admin_id` **text** FK → `user.id` (better-auth ids are text), `timestamp`; composite FK
  `(wmi, vds_code)` → `vds_cache`.
- `vehicle_ledger` — uuid `id`, `vin` (unique, 17), make/year/model/image, decoded
  wmi/vds/vis/plant/country, `hardware_specs` jsonb, `scannedBy` FK → `user.id`, timestamps. ("Brain 1".)
- better-auth tables: `user` (with custom `role` enum + ban fields), `session`, `account`, `verification`.

M3 adds six additive tables (`api_key`, `api_request_log`, `api_idempotency`, `promo_code`,
`promo_redemption`, `credit_purchase`) — full Drizzle definitions in `claude.milestone3.md` §3.

## AI spec drafts (`services/aiService.ts`)

- Model `gemini-2.5-flash`, `temperature: 0.1`, `responseMimeType: "application/json"` with a
  fixed `responseSchema` (engine, transmission, weightAndCapacity, dimensions, tiresAndChassis,
  classification, marketInformation).
- Prompt instructs base-model defaults, no rare trims, metric units, conservative values.
- Custom retry loop on HTTP 503 (waits 2s, 4s, …; 3 tries) before throwing.
- Always returns a `safeDraft` with every section/field defaulted (so the editor never sees `undefined`).

## Deployment (`.github/workflows/deploy.yml`)

- Trigger: push to `main`.
- Frontend: `npm install && npm run build` in `client/` (with `VITE_BACKEND_URL` set), FTP-deploy
  `client/dist/` → `/public_html/ethiovin/`.
- Backend: `npm install && npm run build` in `backend/` (esbuild bundle so prod needs no
  tsx/esbuild native binaries), FTP-deploy `backend/` → `/ethiovin-api/` (excludes `.env`,
  `node_modules`, `.git`, `.github`, `README.md`).
- Passenger/LiteSpeed restart trick: write **changing** content to `backend/tmp/restart.txt`
  (an empty `touch` would be skipped by the FTP delta-sync), refreshing its mtime to force a restart.
- DB migrations are NOT run by CI — apply them manually (`adjust.sql` / generated migrations).
- **`deploy-client.yml` (client-only):** a SECOND workflow that FTPs **only** `client/dist/` →
  `/public_html/ethiovin/`, triggered by `client/**` pushes to `milestone-2` (+ manual dispatch).
  It exists so the public landing page can ship from `milestone-2` WITHOUT a full `main` deploy
  (which would also push the not-yet-migrated M2/M3 backend). Untouched: backend + `web/`.

---

## House style

- Prefer fixing the schema + both write paths (`saveVehicleToLedger` and `submitVerifiedSpec`)
  together; `vehicle_specs` stores a `hardware_specs` jsonb blob (not flat columns).
- Wrap multi-step writes in `db.transaction`.
- Validate every request body with a Zod schema from `utils/validation.ts`; throw `AppError`
  (or let Zod throw) and let the central `errorHandler` shape the response.
- Keep error responses as `{ error: "..." }` with appropriate status codes. (Exception: the M3
  public `/v1` surface has its own structured envelope `{ error: { code, message } }` with a
  router-level handler — the two shapes are separate frozen contracts; never merge them.)
- On the client, surface errors via `<Banner variant="error">` and the `ApiError` message — never `alert()`.

## Debugging notes

- A **404** on a known route usually means the server crashed on boot (no routes mounted) —
  check the _backend terminal_, not the browser console. Common cause: import filename
  mismatch or a dropped `.ts` extension. Note `notFound` returns `{ error: "Not found" }`.
- A **403** means auth resolved but the role check failed — usually the array-vs-spread bug
  or a missing `role` field on the session.
- A **401** from app routes means no valid session reached `attachUser` (cookie not sent —
  check `credentials: "include"` and CORS `credentials: true` + origin allow-list).
- When the verification form shows instead of specs, the cause is almost always (a) a
  cache-key mismatch from a bad slice, or (b) the frontend reading specs from the wrong path.
- `FRONTEND_URL`/`DATABASE_URL` missing → the server throws at boot (by design).

## Known cleanup backlog (non-blocking)

- Orphaned `vehicle_specs` rows accumulate on repeat saves (a new spec is inserted each time).
- `vehicle_ledger` duplicates spec data instead of referencing a `spec_id` (the two spec
  stores are unlinked).
- No AI-vs-human provenance flag on a spec itself (status lives on `vds_cache`).
- Legacy `fuelEnum`/`transEnum`/`bodyStyleEnum` enums remain in the schema but are unused.
- ~~No automated `status = 'conflict'` write path~~ **DONE (M2/T13):** `submitVerifiedSpec` now
  flags `conflict` when a *differing* `hardware_specs` proposal arrives for an already-`verified`
  `(wmi, vds)` key (it keeps the original verified spec in place rather than overwriting), logs
  both proposals to `verification_log`, and leaves resolution to `ConflictsPanel` + `POST /resolve`.
  Identical re-submits stay verified; new/pending keys verify. (Blob comparison uses
  `util.isDeepStrictEqual`, so a benign resubmit with different key insertion order is NOT
  flagged as a conflict — don't revert it to a `JSON.stringify` compare.)
- Build-tooling deps (`esbuild` via `drizzle-kit`) still carry advisories that only `npm audit
  fix --force` (a major bump) would clear — deferred (see "Dependency / vulnerability posture").

---

## Milestone 2 — the contributor network (branch `milestone-2`)

M2 extends the decoder into a multi-sided data network: a public free/premium decode funnel, a
trust-scored contributor network (garages/insurers/diagnosticians), a credit economy, and a **new
Next.js frontend in `web/`** (the legacy Vite SPA `client/` is M1). Backend stays Express + Drizzle +
Postgres + better-auth (extended, not rewritten).

**The detail lives in `claude.milestone2.md`** — new tables, middleware (`requireOrg`/`requireTier`/
`audit`), services (trust/credit/event-spine/decode/health/payment/settings), routes, the design
system, and stubs/handoffs. Read that file before touching M2 code. See also the Documentation map below.

---

## Milestone 3 — the public API platform (built on branch `milestone-2`)

**Status:** backend `/v1` API platform + `web/` developer portal are **shipped** (T1–T13; see
`claude.report.md` for the per-task rundown and the launch/handoff checklist). Concrete surface:
public `/v1` (`decode`/`account`/`usage`/`health`, `decode/batch` a 501 stub), portal
`/api/v1/dev/*` (keys, `billing/*`, `usage/summary`, keyless `demo` + `demo/:vin`), admin
promo/grant/credits-lookup/**pricing**/key-limit on `/api/v1/admin/*`, and `web/` pages
`/developers`, `/developers/docs`, `/dashboard/api`, `/admin/credits`. Schema applied via
`backend/src/db/m3.sql` (idempotent) or migration `0004`.

**Pricing is runtime-editable, not a code constant.** Credit-pack prices + the signup-grant
size live in `app_settings["pricing"]` and are read through `services/pricingService.ts`;
`lib/pricing.ts` only holds the `DEFAULT_PRICING` fallback for a fresh DB. A super_admin edits
them live via `GET`/`PATCH /api/v1/admin/pricing` (the `/admin/credits` UI) — no redeploy. So
the earlier "pricing sign-off" and "swap the demo VINs" handoffs are **closed**: demo VINs now
come from real cached ledger rows, and prices are adjustable in-product.

M3 turns the decode engine into a standalone, sellable developer product: keyed access to a
public **`POST /v1/decode`**, prepaid **credit metering** (1 credit = one decode that returns
data; parse-only misses and invalid VINs are free), per-key rate limits, **Chapa checkout**
(ETB) for credit packs, **promo codes**, and a developer **landing page + key/usage/billing
dashboard in `web/`**. Same Express app, same Postgres, same monorepo — public routes mount at
`/v1` (the one deliberate exception to the `/api/*` rule; host-agnostic, so an
`api.ethiovin.com` subdomain can point at the same app later), portal routes at `/api/v1/dev/*`.

Hard rules (the M3 equivalents of the auth conventions):

- API keys are stored **hashed (SHA-256), shown once**, and looked up by hash. Never log a raw key.
- **`/v1` never reads sessions; `/api/v1/dev/*` never accepts API keys** — two disjoint identity
  channels. Charging identity is `req.apiKey.ownerId`, resolved server-side, never a header.
- There is **ONE credit balance per account** — M3 spends/grants through the M2 ledger via
  `services/creditBridge.ts`. Never create a second wallet store.
- Only decodes that return data are charged, the charge is a guarded conditional decrement, and
  **paid data is never returned on a failed charge**.
- `/v1` responses are a **stable, versioned public contract** (`API_REFERENCE.md` is its source
  of truth) — never leak the internal `/scan` shapes into it.

**The detail lives in `claude.milestone3.md`** — new tables (`api_key`, `api_request_log`,
`api_idempotency`, `promo_code`, `promo_redemption`, `credit_purchase` + idempotent `m3.sql`),
the `/v1` pipeline and limiters, the charging law, Chapa webhook rules (raw-body + verify-API +
replay guards), promo mechanics, portal/landing specs, the failure registry, and the T1–T14
build order. Read that file before touching M3 code.
