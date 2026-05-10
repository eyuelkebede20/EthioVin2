import { db } from "../db";
import { vds_cache, wmi_mapping, nhtsa_models, vehicle_specs, verification_log, vehicle_ledger } from "../db/schema";
import { and, eq, desc, ilike } from "drizzle-orm";
import type { Request, Response } from "express";
import { generateVehicleSpecsDraft } from "../services/aiService";

export const submitVerifiedSpec = async (req: Request, res: Response) => {
  // Use the ID injected by the requireAuth middleware instead of hitting the DB again
  const admin_id = req.headers["x-user-id"] as string;

  if (!admin_id) return res.status(401).json({ error: "Unauthorized" });

  const { wmi, vds_code, engine_cc, fuel, transmission, body_style } = req.body;

  try {
    await db.transaction(async (tx) => {
      // 1. Insert the new/edited specification
      const newSpec = await tx
        .insert(vehicle_specs)
        .values({
          engine_cc,
          fuel,
          transmission,
          body_style,
        })
        .returning({ id: vehicle_specs.id });

      const specId = newSpec[0].id;

      // 2. Log who made this submission/edit
      await tx.insert(verification_log).values({
        wmi,
        vds_code,
        admin_id,
        proposed_spec_id: specId,
      });

      // 3. Upsert the Cache.
      const existingCache = await tx
        .select()
        .from(vds_cache)
        .where(and(eq(vds_cache.wmi, wmi), eq(vds_cache.vds_code, vds_code)));

      if (existingCache.length > 0) {
        await tx
          .update(vds_cache)
          .set({ spec_id: specId, updated_at: new Date() })
          .where(and(eq(vds_cache.wmi, wmi), eq(vds_cache.vds_code, vds_code)));
      } else {
        await tx.insert(vds_cache).values({
          wmi,
          vds_code,
          spec_id: specId,
          status: "verified",
        });
      }
    });

    return res.json({ success: true, message: "Specification saved successfully." });
  } catch (error) {
    console.error("Failed to submit spec:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getConflicts = async (req: Request, res: Response) => {
  try {
    const conflicts = await db
      .select()
      .from(vds_cache)
      .where(eq(vds_cache.status, "conflict"))
      .leftJoin(verification_log, and(eq(vds_cache.wmi, verification_log.wmi), eq(vds_cache.vds_code, verification_log.vds_code)))
      .leftJoin(vehicle_specs, eq(verification_log.proposed_spec_id, vehicle_specs.id));

    return res.json(conflicts);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch conflicts" });
  }
};

export const resolveConflict = async (req: Request, res: Response) => {
  const { wmi, vds_code, selected_spec_id } = req.body;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(vds_cache)
        .set({ spec_id: selected_spec_id, status: "verified", updated_at: new Date() })
        .where(and(eq(vds_cache.wmi, wmi), eq(vds_cache.vds_code, vds_code)));
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to resolve conflict" });
  }
};

function decodeVinYear(vin: string): string {
  if (!vin || vin.length !== 17) return "Unknown";

  const yearChar = vin.charAt(9).toUpperCase();

  // If the manufacturer uses a 0 or other invalid character as a filler
  if (yearChar === "0" || yearChar === "U" || yearChar === "Z") return "Unknown";

  const yearMap: Record<string, number> = {
    A: 1980,
    B: 1981,
    C: 1982,
    D: 1983,
    E: 1984,
    F: 1985,
    G: 1986,
    H: 1987,
    J: 1988,
    K: 1989,
    L: 1990,
    M: 1991,
    N: 1992,
    P: 1993,
    R: 1994,
    S: 1995,
    T: 1996,
    V: 1997,
    W: 1998,
    X: 1999,
    Y: 2000,
    "1": 2001,
    "2": 2002,
    "3": 2003,
    "4": 2004,
    "5": 2005,
    "6": 2006,
    "7": 2007,
    "8": 2008,
    "9": 2009,
  };

  let baseYear = yearMap[yearChar];
  if (!baseYear) return "Unknown";

  const currentYear = new Date().getFullYear();
  if (baseYear + 30 <= currentYear + 2) {
    baseYear += 30;
  }

  return baseYear.toString();
}

export const processVin = async (req: Request, res: Response) => {
  const { vin } = req.body;
  if (!vin || vin.length !== 17 || /[IQO]/i.test(vin)) {
    return res.status(400).json({ error: "Invalid VIN format" });
  }

  const wmi = vin.substring(0, 3).toUpperCase();
  const vds_code = vin.substring(3, 8).toUpperCase();
  const year = decodeVinYear(vin);

  const cachedData = await db
    .select()
    .from(vds_cache)
    .where(and(eq(vds_cache.wmi, wmi), eq(vds_cache.vds_code, vds_code)))
    .leftJoin(vehicle_specs, eq(vds_cache.spec_id, vehicle_specs.id))
    .limit(1);

  if (cachedData.length > 0) {
    return res.json({ hit: true, data: cachedData[0] });
  }

  let predictedManufacturer = "Unknown";
  const wmiRecord = await db.select().from(wmi_mapping).where(eq(wmi_mapping.wmi, wmi)).limit(1);

  if (wmiRecord.length > 0) {
    predictedManufacturer = wmiRecord[0].manufacturer;
  } else {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const nhtsaUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`;
      const nhtsaRes = await fetch(nhtsaUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "EthioVin-App/1.0", Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (nhtsaRes.ok) {
        const data = await nhtsaRes.json();
        const makeResult = data.Results.find((r: any) => r.Variable === "Make");
        if (makeResult && makeResult.Value) {
          predictedManufacturer = makeResult.Value.toUpperCase();
        }
      }
    } catch (err) {
      console.warn("NHTSA Make fallback failed");
    }

    await db.insert(wmi_mapping).values({ wmi, manufacturer: predictedManufacturer }).onConflictDoNothing({ target: wmi_mapping.wmi });
  }

  let suggestedModels: any[] = [];

  if (predictedManufacturer !== "Unknown") {
    // FIX: Only query year models if the year is actually known
    if (year !== "Unknown") {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const yearModelsUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${predictedManufacturer}/modelyear/${year}?format=json`;
        const yearModelsRes = await fetch(yearModelsUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "EthioVin-App/1.0", Accept: "application/json" },
        });
        clearTimeout(timeoutId);

        if (yearModelsRes.ok) {
          const data = await yearModelsRes.json();
          const yearModelsData = data.Results;

          if (yearModelsData && yearModelsData.length > 0) {
            suggestedModels = Array.from(
              new Set(
                yearModelsData
                  // FIX: Drop corrupted items before calling .trim()
                  .filter((m: any) => m && m.Model_Name)
                  .map((m: any) => String(m.Model_Name).trim().toUpperCase()),
              ),
            ).map((modelName, idx) => ({
              id: idx + 9999,
              make: predictedManufacturer,
              model: modelName as string,
            }));
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch ${year} models. Falling back to DB.`);
      }
    }

    if (suggestedModels.length === 0) {
      suggestedModels = await db.select().from(nhtsa_models).where(ilike(nhtsa_models.make, predictedManufacturer));
    }
  }

  return res.json({
    hit: false,
    promptAdmin: true,
    extractedData: { wmi, vds_code, year, manufacturer: predictedManufacturer },
    suggestedModels,
  });
};

export const saveVehicleToLedger = async (req: Request, res: Response) => {
  const { vin, manufacturer, year, model, baseFacts, hardwareSpecs } = req.body;
  const userId = req.headers["x-user-id"] as string;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const newRecord = await db
      .insert(vehicle_ledger)
      .values({
        vin,
        manufacturer,
        year,
        model,
        wmi: baseFacts.wmi,
        vds: baseFacts.vds,
        vis: baseFacts.vis,
        plant: baseFacts.plant,
        country: baseFacts.country,
        hardware_specs: hardwareSpecs,
        scannedBy: userId,
      })
      .returning();

    return res.json({ success: true, record: newRecord[0] });
  } catch (error) {
    console.error("Save to ledger failed:", error);
    return res.status(500).json({ error: "Failed to save vehicle data" });
  }
};

export const generateDraft = async (req: Request, res: Response) => {
  const { manufacturer, year, model } = req.body;

  if (!manufacturer || !year || !model) {
    return res.status(400).json({ error: "Missing required fields: manufacturer, year, or model." });
  }

  try {
    const draft = await generateVehicleSpecsDraft(manufacturer, year, model);
    return res.json({ draft });
  } catch (error) {
    console.error("AI Draft generation failed:", error);
    return res.status(500).json({ error: "Failed to generate AI specs draft." });
  }
};

export const getVehicleImages = async (req: Request, res: Response) => {
  const { manufacturer, year, model, startIndex = 1 } = req.body;

  if (!manufacturer || !model) {
    return res.status(400).json({ error: "Manufacturer and model are required." });
  }

  const query = `${year !== "Unknown" ? year : ""} ${manufacturer} ${model} exterior`.trim();
  const apiKey = process.env.SERPER_API_KEY;

  try {
    const response = await fetch("https://google.serper.dev/images", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Serper API Error:", data);
      throw new Error("Failed to fetch images.");
    }

    // Serper returns a large array of images.
    // We map the URLs and slice exactly the 4 the frontend is asking for.
    const allImages = data.images?.map((item: any) => item.imageUrl) || [];

    // startIndex comes in as 1, 5, 9... we convert to 0-based index
    const startIdx = startIndex - 1;
    const images = allImages.slice(startIdx, startIdx + 4);

    return res.json({ images });
  } catch (error) {
    console.error("Image search failed:", error);
    return res.status(500).json({ error: "Internal server error fetching images." });
  }
};
