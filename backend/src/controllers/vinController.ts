import { db } from "../db/index.ts";
import { vds_cache, wmi_mapping, nhtsa_models, vehicle_specs, verification_log, vehicle_ledger } from "../db/schema.ts";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { generateVehicleSpecsDraft } from "../services/aiService.ts";
import { decodeVinYear } from "../utils/decodeVinYear.ts";
import { AppError } from "../middleware/errorHandler.ts";
import {
  scanSchema,
  saveLedgerSchema,
  submitVerifiedSpecSchema,
  resolveConflictSchema,
  generateDraftSchema,
  getImagesSchema,
} from "../utils/validation.ts";

// ---------------------------------------------------------------------------
// POST /scan — decode a VIN against the ledger + DNA cache.
// ---------------------------------------------------------------------------
export const processVin = async (req: Request, res: Response) => {
  const { vin } = scanSchema.parse(req.body);

  // 1. IDENTITY CHECK — exact VIN already in the ledger?
  const exactMatch = await db.select().from(vehicle_ledger).where(eq(vehicle_ledger.vin, vin)).limit(1);
  const ledgerRow = exactMatch[0];
  if (ledgerRow) {
    return res.json({ hit: true, patientExists: true, data: ledgerRow });
  }

  // 2. DNA EXTRACTION — derive the cache key on the SERVER, never from the client.
  const wmi = vin.substring(0, 3); // positions 1–3
  const vds_code = vin.substring(3, 8); // positions 4–8, 5 chars
  const year = decodeVinYear(vin);

  // 3. PREDICT MAKE from the WMI mapping (Unknown if we've never seen it).
  let predictedManufacturer = "Unknown";
  const wmiRecord = await db.select().from(wmi_mapping).where(eq(wmi_mapping.wmi, wmi)).limit(1);
  if (wmiRecord[0]) {
    predictedManufacturer = wmiRecord[0].manufacturer;
  }

  const extractedData = { wmi, vds_code, year, manufacturer: predictedManufacturer };

  // 4. DNA CACHE CHECK — same (wmi, vds_code) = same model, different VIS still hits.
  const cachedData = await db
    .select()
    .from(vds_cache)
    .where(and(eq(vds_cache.wmi, wmi), eq(vds_cache.vds_code, vds_code)))
    .leftJoin(vehicle_specs, eq(vds_cache.spec_id, vehicle_specs.id))
    .limit(1);

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
  const { vin, manufacturer, year, model, hardwareSpecs, image_url, baseFacts } = body;

  // Derive the cache key the SAME way processVin does — never trust client values.
  const wmi = vin.substring(0, 3);
  const vds_code = vin.substring(3, 8); // positions 4–8, 5 chars

  await db.transaction(async (tx) => {
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
      vin,
      manufacturer,
      year,
      model,
      image_url,
      wmi,
      vds: vds_code,
      vis: baseFacts?.vis ?? null,
      plant: baseFacts?.plant ?? null,
      country: baseFacts?.country ?? null,
      hardware_specs: hardwareSpecs,
      scannedBy: userId,
    };
    await tx
      .insert(vehicle_ledger)
      .values(values)
      .onConflictDoUpdate({ target: vehicle_ledger.vin, set: { ...values, updatedAt: new Date() } });
  });

  const [record] = await db.select().from(vehicle_ledger).where(eq(vehicle_ledger.vin, vin)).limit(1);
  return res.json({ success: true, record });
};

// ---------------------------------------------------------------------------
// POST /verify — an admin submits verified specs for a (wmi, vds_code) key.
// ---------------------------------------------------------------------------
export const submitVerifiedSpec = async (req: Request, res: Response) => {
  const admin_id = req.user?.id;
  if (!admin_id) throw new AppError(401, "Unauthorized");

  const { wmi, vds_code, hardware_specs } = submitVerifiedSpecSchema.parse(req.body);

  await db.transaction(async (tx) => {
    // 1. Insert the verified specification blob.
    const [newSpec] = await tx.insert(vehicle_specs).values({ hardware_specs }).returning({ id: vehicle_specs.id });
    if (!newSpec) throw new AppError(500, "Failed to persist specifications");
    const specId = newSpec.id;

    // 2. Ensure the parent WMI row exists before the cache FK references it.
    await tx.insert(wmi_mapping).values({ wmi, manufacturer: "Unknown" }).onConflictDoNothing();

    // 3. Log who submitted it.
    await tx.insert(verification_log).values({ wmi, vds_code, admin_id, proposed_spec_id: specId });

    // 4. Upsert the cache entry.
    await tx
      .insert(vds_cache)
      .values({ wmi, vds_code, spec_id: specId, status: "verified" })
      .onConflictDoUpdate({
        target: [vds_cache.wmi, vds_cache.vds_code],
        set: { spec_id: specId, status: "verified", updated_at: new Date() },
      });
  });

  return res.json({ success: true, message: "Specification saved successfully." });
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
