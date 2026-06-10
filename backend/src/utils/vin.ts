import { AppError } from "../middleware/errorHandler.ts";
import { decodeVinYear } from "./decodeVinYear.ts";

export interface ParsedVin {
  /** The canonical 17-char VIN (uppercased alphanumerics) used everywhere. */
  keyVin: string;
  wmi: string;
  vds_code: string;
  year: string;
  vis: string;
  plant: string;
}

/**
 * Parse a 17-character VIN into its cache key + decoded facts.
 *
 * We do NOT strip I/O/Q: these imported VINs legitimately contain O (e.g.
 * "LCO…"), and removing it would shift every position left — which mis-read the
 * year (position 10) as 2004 instead of 2025. The VIN is the cache key as-is:
 * wmi = positions 1–3, vds_code = positions 4–8, year = position 10.
 */
export function parseVin(input: unknown): ParsedVin {
  if (typeof input !== "string") throw new AppError(400, "VIN is required");

  const vin = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (vin.length !== 17) {
    throw new AppError(400, "VIN must be exactly 17 characters");
  }

  return {
    keyVin: vin,
    wmi: vin.substring(0, 3), // positions 1–3
    vds_code: vin.substring(3, 8), // positions 4–8, 5 chars
    year: decodeVinYear(vin), // position 10 (index 9)
    vis: vin.substring(9),
    plant: vin.substring(10, 11),
  };
}
