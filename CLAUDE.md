# CLAUDE.md — EthioVin

VIN decoder for cars imported to Ethiopia. Decodes WMI/VDS from a VIN, serves cached
specs when known, and falls back to an admin verification flow (Gemini draft + image
search) for unknown vehicles. The verified result is cached so future cars of the same
model decode instantly.

## Stack

- **Runtime:** Node 22, `tsx watch` for dev (`npm run dev`)
- **Framework:** Express 5
- **DB:** PostgreSQL via Drizzle ORM (`drizzle-kit` for migrations)
- **Auth:** better-auth (email/password + `admin()` plugin)
- **External:** Google GenAI (Gemini 2.5 Flash) for spec drafts, Serper for image search
- **Module system:** ESM (`"type": "module"`). Imports MUST include the `.ts` extension
  (e.g. `import { auth } from "./auth.ts"`). Dropping it breaks resolution.

## Project layout

- `src/index.ts` — app entry, CORS, route mounts, global middleware
- `src/auth.ts` — better-auth config
- `src/db/schema.ts` — Drizzle schema (source of truth for tables)
- `src/controllers/` — `vinController.ts`, `adminController.ts`
- `src/routes/` — `vinRoutes.ts`, `adminRoutes.ts`
- `src/middleware/authMiddleware.ts` — `attachUser`, `requireAuth`, `requireRole`
- `src/services/aiService.ts` — Gemini draft generation
- `src/utils/helpers.ts` — `sanitizeVin`, etc.

## Commands

- `npm run dev` — start dev server (watch mode)
- `npm run db:generate` — generate a migration from schema changes
- `npm run db:push` — apply schema to the DB
- `npm run db:studio` — Drizzle Studio

After ANY change to `src/db/schema.ts`, run `db:generate` then `db:push` before testing.

---

## VIN parsing — THE most important convention

A VIN is 17 chars. Positions are 1-indexed in spec language but 0-indexed in JS strings.
The ONLY correct slices in this codebase:

```ts
const wmi = vin.substring(0, 3); // positions 1–3  → 3 chars
const vds_code = vin.substring(3, 8); // positions 4–8  → 5 chars (NOT the check digit)
const year = decodeVinYear(vin); // position 10 (+ position 7 to pick the 30-yr cycle)
```

- `vds_code` is **5 characters**, sliced `(3, 8)`. Never `(4, 8)` (that's 4 chars and skips
  position 4) — that off-by-one was a real bug that produced shifted keys like `LCC`/`E4CB7`
  instead of `LCO`/`CE4CB`. The schema column is `varchar(5)` and `submitVerifiedSpec`
  validates `length === 5`; keep all three in agreement.
- **Derive wmi/vds on the SERVER from the VIN — never trust client-sent values for the
  cache key.** The frontend must display/submit `extractedData.wmi` / `extractedData.vds_code`
  from the `/scan` response, not re-slice the VIN in the browser, or the displayed key, the
  saved key, and the lookup key can drift apart.
- `decodeVinYear` uses position 7 (index 6): a letter → 2010+ cycle, a digit → 1980–2009.
  This matters because many imports are pre-2010; without it, old cars decode as recent.

## The cache model (the "self-improving" core)

- `vds_cache` is keyed on `(wmi, vds_code)` — exact 5-char match, no wildcards. Same model +
  different VIS (positions 11–17) share a key and hit the cache. Different VDS = different
  model = correctly a miss.
- `vds_cache.wmi` has an FK to `wmi_mapping.wmi`. **You must seed the parent WMI row before
  inserting the cache row**, or you get FK error 23503. Both `saveVehicleToLedger` and
  `submitVerifiedSpec` upsert `wmi_mapping` (as `"Unknown"` if not known) before the cache
  insert. Unknown WMIs surface to admins via `getUnknownWMIs` (`manufacturer = 'Unknown'`).
- `updateWMI` only UPDATEs; it cannot create a WMI. New WMIs must be seeded by the save path.

## `/scan` response shapes (frontend must branch on these)

Three distinct shapes from `processVin`:

1. **Exact VIN in ledger:** `{ hit: true, patientExists: true, data: <vehicle_ledger row> }`
   — specs at `data.hardware_specs`.
2. **Cache hit:** `{ hit: true, patientExists: false, extractedData, data }` — specs flattened
   to `data.hardware_specs`. Identity (make/year) comes from `extractedData`, NOT `data`
   (the cache row has no model/manufacturer).
3. **Miss:** `{ hit: false, promptAdmin: true, extractedData, suggestedModels }` — show the
   verification form.

Frontend render rule: `hit` → show specs; else `promptAdmin` → show form. Don't branch on
the presence of `hardware_specs` or on `suggestedModels`.

---

## Auth conventions (where most bugs came from)

- **better-auth only guards `/api/auth/*`.** It does NOT protect `/api/v1/*` — those use our
  own middleware. Always gate app routes explicitly.
- **Identity comes from the session, never a header.** Read `req.user.id` (set by
  `attachUser`). Never read `req.headers["x-user-id"]` and never put `x-user-id` in CORS
  `allowedHeaders` — it's client-spoofable.
- **`requireRole` takes SPREAD string args, not an array:**
  ```ts
  router.post("/verify", requireRole("super_admin", "garage_admin"), handler); // ✅
  router.post("/verify", requireRole(["super_admin"]), handler); // ❌ always 403
  ```
  An array as a single arg never matches `roles.includes(req.user.role)`. This caused
  repeated phantom 403s.
- **Don't stack `requireRole` and `requireAuth` on the same route** — `requireRole` already
  rejects unauthenticated users. Use `requireAuth` alone for any-logged-in-user routes,
  `requireRole(...)` alone for role-restricted ones.
- Custom roles must be surfaced to the session via `auth.ts`:
  ```ts
  user: { additionalFields: { role: { type: "string", input: false } } }
  ```
  Without this, `req.user.role` is undefined → 403 even for a real super_admin.
- Don't pass custom role names to the `admin()` plugin's `adminRoles` — it only accepts roles
  defined in its own `roles` config and throws at boot otherwise. Our middleware handles
  authorization; the plugin is just for user management (ban/impersonate).
- Roles: `super_admin`, `garage_admin`, `diagnostician`, `insurance`, `user`. New signups
  default to `user`. Promote via SQL: `UPDATE "user" SET role = 'super_admin' WHERE email = ?`.

## Debugging notes

- A **404** on a known route usually means the server crashed on boot (no routes mounted) —
  check the _backend terminal_, not the browser console. Common cause: import filename
  mismatch (`auth.ts` vs `authMiddleware.ts`). Keep all imports pointing at the real file.
- A **403** means auth resolved but the role check failed — usually the array-vs-spread bug
  or a missing `role` field on the session.
- When the verification form shows instead of specs, the cause is almost always (a) a
  cache-key mismatch from a bad slice, or (b) the frontend reading specs from the wrong path.

## House style

- Prefer fixing the schema + both write paths together; `vehicle_specs` stores a
  `hardware_specs` jsonb blob (not flat columns — the `fuelEnum`/`transEnum`/`bodyStyleEnum`
  are leftovers from an old design).
- Wrap multi-step writes in `db.transaction`.
- Keep error responses as `{ error: "..." }` with appropriate status codes.

## Known cleanup backlog (non-blocking)

- Orphaned `vehicle_specs` rows accumulate on repeat saves (new spec inserted each time).
- `vehicle_ledger` duplicates spec data instead of referencing a `spec_id` (two unlinked
  spec stores).
- No AI-vs-human provenance flag on a spec itself (status lives on `vds_cache`).
- Dead `normalizeSpecs` branch in `aiService.ts` (always false — `typeof` on an undeclared
  name).
- Old commented-out `saveVehicleToLedger` block and unused `desc`/`ilike` imports in
  `vinController.ts`.
