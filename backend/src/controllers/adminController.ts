import type { Request, Response } from "express";
import { db } from "../db/index.ts";
import { wmi_mapping } from "../db/schema.ts";
import { eq, isNotNull } from "drizzle-orm";
import { AppError } from "../middleware/errorHandler.ts";
import { updateWmiSchema } from "../utils/validation.ts";

/** WMIs we've seen but can't attribute to a manufacturer yet. */
export const getUnknownWMIs = async (_req: Request, res: Response) => {
  const unknowns = await db.select().from(wmi_mapping).where(eq(wmi_mapping.manufacturer, "Unknown"));
  return res.json(unknowns);
};

/** Distinct known manufacturers (excludes "Unknown"/blank), for select menus. */
export const getDistinctManufacturers = async (_req: Request, res: Response) => {
  const result = await db.selectDistinct({ manufacturer: wmi_mapping.manufacturer }).from(wmi_mapping).where(isNotNull(wmi_mapping.manufacturer));

  const manufacturers = result
    .map((r) => r.manufacturer)
    .filter((m) => m !== "Unknown" && m.trim() !== "")
    .sort();

  return res.json(manufacturers);
};

/**
 * Attribute a manufacturer (and optional country) to an existing WMI. This only
 * UPDATEs — new WMIs are seeded by the save path — so a missing WMI is a 404.
 */
export const updateWMI = async (req: Request, res: Response) => {
  const { wmi, manufacturer, country } = updateWmiSchema.parse(req.body);

  const updated = await db
    .update(wmi_mapping)
    .set({ manufacturer, country: country ?? null, updated_at: new Date() })
    .where(eq(wmi_mapping.wmi, wmi))
    .returning({ wmi: wmi_mapping.wmi });

  if (!updated[0]) throw new AppError(404, "WMI not found");

  return res.json({ success: true });
};
