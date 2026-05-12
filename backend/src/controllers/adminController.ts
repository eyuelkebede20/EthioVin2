import type { Request, Response } from "express";
import { db } from "../db";
import { wmi_mapping } from "../db/schema";
import { eq } from "drizzle-orm";

export const getUnknownWMIs = async (req: Request, res: Response) => {
  try {
    const unknowns = await db.select().from(wmi_mapping).where(eq(wmi_mapping.manufacturer, "Unknown"));
    return res.json(unknowns);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch WMIs" });
  }
};
export const getDistinctManufacturers = async (req: Request, res: Response) => {
  try {
    const result = await db.selectDistinct({ manufacturer: wmi_mapping.manufacturer }).from(wmi_mapping).where(isNotNull(wmi_mapping.manufacturer));

    const manufacturers = result.map((r) => r.manufacturer).filter((m) => m !== "Unknown" && m.trim() !== "");

    return res.json(manufacturers);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch manufacturers" });
  }
};
export const updateWMI = async (req: Request, res: Response) => {
  const { wmi, manufacturer, country } = req.body;
  try {
    await db.update(wmi_mapping).set({ manufacturer, country, updated_at: new Date() }).where(eq(wmi_mapping.wmi, wmi));
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update WMI" });
  }
};

export const getManufacturers = async (req: Request, res: Response) => {
  try {
    // 1. Use selectDistinct instead of groupBy
    const results = await db.selectDistinct({ manufacturer: wmi_mapping.manufacturer }).from(wmi_mapping);

    // 2. Format the array
    const manufacturers = results
      .map((r) => r.manufacturer)
      .filter(Boolean)
      .sort();

    return res.json(manufacturers);
  } catch (error) {
    console.error("[Admin API] Crash in getManufacturers:", error);
    return res.status(500).json({ error: "Failed to fetch manufacturers." });
  }
};
