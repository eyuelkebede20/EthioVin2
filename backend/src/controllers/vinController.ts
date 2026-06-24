import { db } from "../db/index.ts";
import { vds_cache, wmi_mapping, nhtsa_models, vehicle_specs, verification_log, vehicle_ledger } from "../db/schema.ts";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { generateVehicleSpecsDraft } from "../services/aiService.ts";
import { parseVin } from "../utils/vin.ts";
import { AppError } from "../middleware/errorHandler.ts";
import {
  scanSchema,
  saveLedgerSchema,
  submitVerifiedSpecSchema,
  resolveConflictSchema,
  generateDraftSchema,
  getImagesSchema,
  updateLedgerSchema,
} from "../utils/validation.ts";

// ---------------------------------------------------------------------------
// POST /scan — decode a VIN against the ledger + DNA cache.
// ---------------------------------------------------------------------------
export const processVin = async (req: Request, res: Response) => {
  const { vin: rawVin } = scanSchema.parse(req.body);

  // Parse on the SERVER: cache key from the I/O/Q-stripped form, year from the raw
  // VIN (so an 18-char "LCO…" decodes position 10 correctly).
  const { keyVin, wmi, vds_code, year } = parseVin(rawVin);

  // 1. IDENTITY CHECK — exact VIN already in the ledger?
  const exactMatch = await db.select().from(vehicle_ledger).where(eq(vehicle_ledger.vin, keyVin)).limit(1);
  const ledgerRow = exactMatch[0];
  if (ledgerRow) {
    return res.json({ hit: true, patientExists: true, data: ledgerRow });
  }

  // 3. WMI prediction + DNA cache check are independent lookups — run them in
  //    parallel (postgres-js pipelines them over the single connection) instead
  //    of paying two sequential round-trips on every cache-hit/miss.
  const [wmiRecord, cachedData] = await Promise.all([
    // PREDICT MAKE from the WMI mapping (Unknown if we've never seen it).
    db.select().from(wmi_mapping).where(eq(wmi_mapping.wmi, wmi)).limit(1),
    // DNA CACHE CHECK — same (wmi, vds_code) = same model, different VIS still hits.
    db
      .select()
      .from(vds_cache)
      .where(and(eq(vds_cache.wmi, wmi), eq(vds_cache.vds_code, vds_code)))
      .leftJoin(vehicle_specs, eq(vds_cache.spec_id, vehicle_specs.id))
      .limit(1),
  ]);

  const predictedManufacturer = wmiRecord[0]?.manufacturer ?? "Unknown";
  const extractedData = { wmi, vds_code, year, manufacturer: predictedManufacturer };

  const cacheRow = cachedData[0];
  if (cacheRow) {
    // Same (wmi, vds_code) = same model. Pull model/make/image from a sibling
    // ledger row (any recorded VIN of this model) so the client can show the full
    // car and record this VIN without re-entering shared data. Year stays per-VIN.
    const sibling = await db
      .select({
        manufacturer: vehicle_ledger.manufacturer,
        model: vehicle_ledger.model,
        year: vehicle_ledger.year,
        image_url: vehicle_ledger.image_url,
      })
      .from(vehicle_ledger)
      .where(and(eq(vehicle_ledger.wmi, wmi), eq(vehicle_ledger.vds, vds_code)))
      // Prefer a sibling that actually has an image, then the most recent one.
      .orderBy(sql`(${vehicle_ledger.image_url} is not null and ${vehicle_ledger.image_url} <> '') desc`, desc(vehicle_ledger.updatedAt))
      .limit(1);

    return res.json({
      hit: true,
      patientExists: false,
      extractedData,
      reference: sibling[0] ?? null,
      data: {
        ...cacheRow.vds_cache,
        hardware_specs: cacheRow.vehicle_specs?.hardware_specs ?? null,
        status: cacheRow.vds_cache.status,
      },
    });
  }

  // 5. MISS — prompt the admin verification flow, with model suggestions if we
  //    know the make. nhtsa_models is stored title-cased; match case-insensitively.
  let suggestedModels: Array<{ id: number; make: string; model: string }> = [];
  if (predictedManufacturer !== "Unknown") {
    suggestedModels = await db
      .select({ id: nhtsa_models.id, make: nhtsa_models.make, model: nhtsa_models.model })
      .from(nhtsa_models)
      .where(ilike(nhtsa_models.make, predictedManufacturer))
      .limit(50);
  }

  return res.json({
    hit: false,
    patientExists: false,
    promptAdmin: true,
    extractedData,
    suggestedModels,
  });
};

// ---------------------------------------------------------------------------
// POST /log — save a verified vehicle to the ledger AND seed the shared cache.
// ---------------------------------------------------------------------------
export const saveVehicleToLedger = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");

  const body = saveLedgerSchema.parse(req.body);
  const { manufacturer, year, model, hardwareSpecs, image_url, baseFacts } = body;

  // Derive the cache key the SAME way processVin does — never trust client values.
  const { keyVin, wmi, vds_code, vis, plant } = parseVin(body.vin);

  const record = await db.transaction(async (tx) => {
    // 1. Save the shared spec blob (Brain 2).
    const [savedSpec] = await tx.insert(vehicle_specs).values({ hardware_specs: hardwareSpecs }).returning({ id: vehicle_specs.id });
    if (!savedSpec) throw new AppError(500, "Failed to persist specifications");

    // 2. Ensure the parent WMI row exists (FK target for vds_cache). Seed it if
    //    missing, upgrade it if currently "Unknown", but never clobber a known make.
    await tx
      .insert(wmi_mapping)
      .values({ wmi, manufacturer })
      .onConflictDoUpdate({
        target: wmi_mapping.wmi,
        set: { manufacturer, updated_at: new Date() },
        setWhere: eq(wmi_mapping.manufacturer, "Unknown"),
      });

    // 3. Write the cache — this is what makes a different-VIS car decode next time.
    await tx.insert(vds_cache).values({ wmi, vds_code, spec_id: savedSpec.id, status: "verified" }).onConflictDoNothing();

    // 4. Save the exact identity (Brain 1).
    const values = {
      vin: keyVin,
      manufacturer,
      year,
      model,
      image_url,
      wmi,
      vds: vds_code,
      vis: baseFacts?.vis ?? vis,
      plant: baseFacts?.plant ?? plant,
      country: baseFacts?.country ?? null,
      hardware_specs: hardwareSpecs,
      scannedBy: userId,
    };
    // Return the upserted row directly — no need for a follow-up SELECT round-trip.
    const [row] = await tx
      .insert(vehicle_ledger)
      .values(values)
      .onConflictDoUpdate({ target: vehicle_ledger.vin, set: { ...values, updatedAt: new Date() } })
      .returning();
    return row;
  });

  return res.json({ success: true, record });
};

// ---------------------------------------------------------------------------
// PATCH /ledger/:vin — fix an existing record's identity fields (year/model/etc).
// Updates only the row; leaves the WMI/VDS cache key and shared specs untouched.
// ---------------------------------------------------------------------------
export const updateLedger = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");

  const vinParam = String(req.params.vin ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (vinParam.length !== 17) throw new AppError(400, "Invalid VIN");

  const updates = updateLedgerSchema.parse(req.body);

  const set: Partial<typeof vehicle_ledger.$inferInsert> = { updatedAt: new Date() };
  if (updates.manufacturer !== undefined) set.manufacturer = updates.manufacturer;
  if (updates.year !== undefined) set.year = updates.year;
  if (updates.model !== undefined) set.model = updates.model;
  if (updates.image_url !== undefined) {
    const url = typeof updates.image_url === "string" ? updates.image_url.trim() : "";
    if (url && !/^https?:\/\//.test(url)) throw new AppError(400, "image_url must be a valid http(s) URL");
    set.image_url = url || null;
  }
  if (Object.keys(set).length === 1) throw new AppError(400, "No fields to update");

  const updated = await db.update(vehicle_ledger).set(set).where(eq(vehicle_ledger.vin, vinParam)).returning();
  if (!updated[0]) throw new AppError(404, "Vehicle not found");

  return res.json({ success: true, record: updated[0] });
};

// ---------------------------------------------------------------------------
// PATCH /specs — edit the SHARED specs for a (wmi, vds_code). Updates the cached
// spec in place and every ledger row of that model, since specs are shared.
// ---------------------------------------------------------------------------
export const updateSpecs = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, "Unauthorized");

  const { wmi, vds_code, hardware_specs } = submitVerifiedSpecSchema.parse(req.body);

  await db.transaction(async (tx) => {
    const cache = await tx
      .select({ spec_id: vds_cache.spec_id })
      .from(vds_cache)
      .where(and(eq(vds_cache.wmi, wmi), eq(vds_cache.vds_code, vds_code)))
      .limit(1);
    if (!cache[0]) throw new AppError(404, "No cached specs for this WMI/VDS");

    await tx.update(vehicle_specs).set({ hardware_specs }).where(eq(vehicle_specs.id, cache[0].spec_id));
    await tx
      .update(vehicle_ledger)
      .set({ hardware_specs, updatedAt: new Date() })
      .where(and(eq(vehicle_ledger.wmi, wmi), eq(vehicle_ledger.vds, vds_code)));
  });

  return res.json({ success: true, hardware_specs });
};

// ---------------------------------------------------------------------------
// POST /verify — an admin submits verified specs for a (wmi, vds_code) key.
// ---------------------------------------------------------------------------
export const submitVerifiedSpec = async (req: Request, res: Response) => {
  const admin_id = req.user?.id;
  if (!admin_id) throw new AppError(401, "Unauthorized");

  const { wmi, vds_code, hardware_specs } = submitVerifiedSpecSchema.parse(req.body);

  const outcome: "verified" | "conflict" = await db.transaction(async (tx) => {
    // 1. Insert the proposed specification blob.
    const [newSpec] = await tx.insert(vehicle_specs).values({ hardware_specs }).returning({ id: vehicle_specs.id });
    if (!newSpec) throw new AppError(500, "Failed to persist specifications");
    const specId = newSpec.id;

    // 2. Ensure the parent WMI row exists before the cache FK references it.
    await tx.insert(wmi_mapping).values({ wmi, manufacturer: "Unknown" }).onConflictDoNothing();

    // 3. Log the proposal (ConflictsPanel joins verification_log to show competing specs).
    await tx.insert(verification_log).values({ wmi, vds_code, admin_id, proposed_spec_id: specId });

    // 4. Look at the existing cache row + its current spec blob to decide verified vs conflict.
    const [existing] = await tx
      .select({ status: vds_cache.status, specs: vehicle_specs.hardware_specs })
      .from(vds_cache)
      .where(and(eq(vds_cache.wmi, wmi), eq(vds_cache.vds_code, vds_code)))
      .leftJoin(vehicle_specs, eq(vds_cache.spec_id, vehicle_specs.id))
      .limit(1);

    if (!existing) {
      // Brand-new key — accept as verified.
      await tx.insert(vds_cache).values({ wmi, vds_code, spec_id: specId, status: "verified" });
      return "verified";
    }

    if (existing.status === "verified") {
      // A second proposal for an already-verified key. If it DIFFERS, flag a conflict
      // for super-admin review (keep the original verified spec in place — don't clobber
      // it); if identical, leave it verified. (Comparison is order-sensitive on the JSON
      // blob — the spec editor emits stable key order, so this is sufficient in practice.)
      const differs = JSON.stringify(existing.specs ?? null) !== JSON.stringify(hardware_specs);
      await tx
        .update(vds_cache)
        .set(differs ? { status: "conflict", updated_at: new Date() } : { updated_at: new Date() })
        .where(and(eq(vds_cache.wmi, wmi), eq(vds_cache.vds_code, vds_code)));
      return differs ? "conflict" : "verified";
    }

    if (existing.status === "conflict") {
      // Already under review — this proposal is logged (step 3) but we don't auto-resolve;
      // POST /resolve picks the winner.
      await tx.update(vds_cache).set({ updated_at: new Date() }).where(and(eq(vds_cache.wmi, wmi), eq(vds_cache.vds_code, vds_code)));
      return "conflict";
    }

    // pending / rejected — accept this proposal as the verified spec.
    await tx.update(vds_cache).set({ spec_id: specId, status: "verified", updated_at: new Date() }).where(and(eq(vds_cache.wmi, wmi), eq(vds_cache.vds_code, vds_code)));
    return "verified";
  });

  return res.json({
    success: true,
    status: outcome,
    message: outcome === "conflict" ? "A differing specification already exists for this model — your proposal was recorded for review." : "Specification saved successfully.",
  });
};

// ---------------------------------------------------------------------------
// GET /conflicts — cache rows flagged as conflicting, with their proposals.
// ---------------------------------------------------------------------------
export const getConflicts = async (_req: Request, res: Response) => {
  const conflicts = await db
    .select()
    .from(vds_cache)
    .where(eq(vds_cache.status, "conflict"))
    .leftJoin(verification_log, and(eq(vds_cache.wmi, verification_log.wmi), eq(vds_cache.vds_code, verification_log.vds_code)))
    .leftJoin(vehicle_specs, eq(verification_log.proposed_spec_id, vehicle_specs.id));

  return res.json(conflicts);
};

// ---------------------------------------------------------------------------
// POST /resolve — pick the winning spec for a conflicting cache key.
// ---------------------------------------------------------------------------
export const resolveConflict = async (req: Request, res: Response) => {
  const { wmi, vds_code, selected_spec_id } = resolveConflictSchema.parse(req.body);

  // Only allow selecting a spec that was actually proposed for THIS key.
  const proposal = await db
    .select({ id: verification_log.id })
    .from(verification_log)
    .where(and(eq(verification_log.wmi, wmi), eq(verification_log.vds_code, vds_code), eq(verification_log.proposed_spec_id, selected_spec_id)))
    .limit(1);
  if (!proposal[0]) throw new AppError(400, "selected_spec_id was not proposed for this WMI/VDS");

  const updated = await db
    .update(vds_cache)
    .set({ spec_id: selected_spec_id, status: "verified", updated_at: new Date() })
    .where(and(eq(vds_cache.wmi, wmi), eq(vds_cache.vds_code, vds_code)))
    .returning({ wmi: vds_cache.wmi });
  if (!updated[0]) throw new AppError(404, "No cache entry for this WMI/VDS");

  return res.json({ success: true });
};

// ---------------------------------------------------------------------------
// POST /generate-draft — AI-drafted specs for a make/model/year.
// ---------------------------------------------------------------------------
export const generateDraft = async (req: Request, res: Response) => {
  const { manufacturer, year, model } = generateDraftSchema.parse(req.body);

  try {
    const draft = await generateVehicleSpecsDraft(manufacturer, year, model);
    return res.json({ draft });
  } catch (error) {
    console.error("AI Draft generation failed:", error);
    throw new AppError(502, "Failed to generate AI specs draft.");
  }
};

// ---------------------------------------------------------------------------
// POST /images — proxy an image search for a make/model/year.
// ---------------------------------------------------------------------------
export const getVehicleImages = async (req: Request, res: Response) => {
  const { manufacturer, year, model, startIndex } = getImagesSchema.parse(req.body);

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new AppError(500, "Image search is not configured");

  const query = `${year && year !== "Unknown" ? year : ""} ${manufacturer} ${model} exterior`.trim();

  let data: { images?: Array<{ imageUrl?: string }> };
  try {
    const response = await fetch("https://google.serper.dev/images", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query }),
    });
    data = (await response.json()) as typeof data;
    if (!response.ok) {
      console.error("Serper API error:", data);
      throw new Error("Serper request failed");
    }
  } catch (error) {
    console.error("Image search failed:", error);
    throw new AppError(502, "Failed to fetch images.");
  }

  const allImages = (data.images ?? []).map((item) => item.imageUrl).filter((u): u is string => typeof u === "string");
  const startIdx = startIndex - 1; // client sends 1-based
  const images = allImages.slice(startIdx, startIdx + 4);

  return res.json({ images });
};
