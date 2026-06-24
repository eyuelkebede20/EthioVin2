import type { Request, Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { vehicle_ledger, vds_cache, vehicle_specs, wmi_mapping, vehicle_events } from "../db/schema.ts";
import { parseVin } from "../utils/vin.ts";
import { buildDecodeView, type VehicleIdentity } from "../services/decodeView.ts";
import { writeAudit } from "../middleware/audit.ts";

// Resolve a VIN to its best-known identity + shared specs, deriving everything
// on the SERVER via parseVin (never trusting client values). Mirrors processVin's
// lookup order: exact ledger row → DNA cache (with a sibling for make/model/image)
// → decoded-basics-only on a miss.
export async function resolveVehicle(rawVin: string): Promise<{ identity: VehicleIdentity; specs: Record<string, unknown> | null }> {
  const { keyVin, wmi, vds_code, year, vis } = parseVin(rawVin);

  // 1. Exact VIN already recorded.
  const [ledger] = await db.select().from(vehicle_ledger).where(eq(vehicle_ledger.vin, keyVin)).limit(1);
  if (ledger) {
    return {
      identity: {
        vin: ledger.vin,
        manufacturer: ledger.manufacturer,
        model: ledger.model,
        year: ledger.year,
        image_url: ledger.image_url,
        wmi: ledger.wmi,
        vds: ledger.vds,
        vis: ledger.vis,
        country: ledger.country,
      },
      specs: ledger.hardware_specs as Record<string, unknown>,
    };
  }

  // Predicted make from the WMI mapping (Unknown if never seen).
  const [wmiRow] = await db.select({ manufacturer: wmi_mapping.manufacturer }).from(wmi_mapping).where(eq(wmi_mapping.wmi, wmi)).limit(1);
  const predictedMake = wmiRow?.manufacturer ?? "Unknown";

  // 2. DNA cache hit (same wmi+vds, different VIN). Pull make/model/image from a
  //    sibling ledger row (prefer one with an image, then most recent).
  const [cache] = await db
    .select()
    .from(vds_cache)
    .where(and(eq(vds_cache.wmi, wmi), eq(vds_cache.vds_code, vds_code)))
    .leftJoin(vehicle_specs, eq(vds_cache.spec_id, vehicle_specs.id))
    .limit(1);
  if (cache) {
    const [sibling] = await db
      .select({ manufacturer: vehicle_ledger.manufacturer, model: vehicle_ledger.model, image_url: vehicle_ledger.image_url })
      .from(vehicle_ledger)
      .where(and(eq(vehicle_ledger.wmi, wmi), eq(vehicle_ledger.vds, vds_code)))
      .orderBy(sql`(${vehicle_ledger.image_url} is not null and ${vehicle_ledger.image_url} <> '') desc`, desc(vehicle_ledger.updatedAt))
      .limit(1);
    return {
      identity: {
        vin: keyVin,
        manufacturer: sibling?.manufacturer ?? predictedMake,
        model: sibling?.model ?? null,
        year,
        image_url: sibling?.image_url ?? null,
        wmi,
        vds: vds_code,
        vis,
        country: null,
      },
      specs: (cache.vehicle_specs?.hardware_specs as Record<string, unknown> | undefined) ?? null,
    };
  }

  // 3. Miss — return the decoded basics we can derive from the VIN itself.
  return {
    identity: { vin: keyVin, manufacturer: predictedMake, model: null, year, image_url: null, wmi, vds: vds_code, vis, country: null },
    specs: null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/v1/decode/:vin — PUBLIC, free tier. The acquisition funnel: anyone
// (logged in or not) gets identity + a basic spec teaser + a history COUNT.
// ---------------------------------------------------------------------------
export const publicDecode = async (req: Request, res: Response) => {
  const { identity, specs } = await resolveVehicle(String(req.params.vin ?? ""));

  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(vehicle_events).where(eq(vehicle_events.vin, identity.vin));
  const historyCount = row?.count ?? 0;

  return res.json(buildDecodeView({ identity, specs, historyCount, tier: "free" }));
};

// ---------------------------------------------------------------------------
// GET /api/v1/decode/:vin/full — premium. Full specs + full history. Audited.
// ---------------------------------------------------------------------------
export const premiumDecode = async (req: Request, res: Response) => {
  const { identity, specs } = await resolveVehicle(String(req.params.vin ?? ""));

  const history = await db
    .select()
    .from(vehicle_events)
    .where(eq(vehicle_events.vin, identity.vin))
    .orderBy(desc(vehicle_events.occurredAt), desc(vehicle_events.createdAt))
    .limit(500);

  await writeAudit(req, { action: "decode.premium", resourceType: "vehicle", resourceId: identity.vin, metadata: { historyCount: history.length } });

  return res.json(buildDecodeView({ identity, specs, history, tier: "premium" }));
};
