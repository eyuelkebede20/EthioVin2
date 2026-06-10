import { z } from "zod";

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

/** A full ISO VIN: sanitized to uppercase alphanumerics, exactly 17 chars, no I/O/Q. */
export const vinField = z
  .string()
  .transform((s) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .refine((s) => s.length === 17, "VIN must be exactly 17 characters")
  .refine((s) => !/[IOQ]/.test(s), "VIN must not contain the letters I, O, or Q");

/** WMI: positions 1–3, exactly 3 alphanumerics. */
export const wmiField = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .refine((s) => /^[A-Z0-9]{3}$/.test(s), "wmi must be exactly 3 alphanumeric characters");

/** VDS cache key: positions 4–8, exactly 5 alphanumerics. */
export const vdsField = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .refine((s) => /^[A-Z0-9]{5}$/.test(s), "vds_code must be exactly 5 alphanumeric characters");

const shortText = z.string().trim().min(1).max(100);

/** Year as a 4-digit string or the literal "Unknown". */
const yearField = z
  .string()
  .trim()
  .refine((s) => s === "Unknown" || /^\d{4}$/.test(s), "year must be a 4-digit year or 'Unknown'");

/** An http(s) image URL, length-bounded. Empty/absent allowed (-> null). */
const imageUrlField = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
  .refine((v) => v === null || (/^https?:\/\//.test(v) && v.length <= 2048), "image_url must be a valid http(s) URL");

// ---------------------------------------------------------------------------
// hardware_specs: a flexible but bounded jsonb blob.
// Top-level keys map to either a primitive or a one-level object of primitives.
// We also cap the serialized size so a client can't store arbitrary payloads.
// ---------------------------------------------------------------------------

const specPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const specSection = z.record(z.string(), specPrimitive);

export const hardwareSpecsSchema = z
  .record(z.string(), z.union([specPrimitive, specSection]))
  .refine((v) => Object.keys(v).length > 0, "hardware_specs must not be empty")
  .refine((v) => JSON.stringify(v).length <= 20_000, "hardware_specs payload is too large");

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

export const scanSchema = z.object({ vin: vinField });

export const generateDraftSchema = z.object({
  manufacturer: shortText,
  model: shortText,
  year: yearField,
});

export const getImagesSchema = z.object({
  manufacturer: shortText,
  model: shortText,
  year: z.string().trim().max(10).optional(),
  startIndex: z.coerce.number().int().min(1).max(100).optional().default(1),
});

export const submitVerifiedSpecSchema = z.object({
  wmi: wmiField,
  vds_code: vdsField,
  hardware_specs: hardwareSpecsSchema,
});

export const resolveConflictSchema = z.object({
  wmi: wmiField,
  vds_code: vdsField,
  selected_spec_id: z.coerce.number().int().positive(),
});

export const saveLedgerSchema = z.object({
  vin: vinField,
  manufacturer: shortText,
  year: yearField,
  model: shortText,
  hardwareSpecs: hardwareSpecsSchema,
  image_url: imageUrlField,
  baseFacts: z
    .object({
      vis: z.string().trim().max(20).optional(),
      plant: z.string().trim().max(10).optional(),
      country: z.string().trim().max(100).optional(),
    })
    .partial()
    .optional(),
});

export const updateWmiSchema = z.object({
  wmi: wmiField,
  manufacturer: shortText,
  country: z.string().trim().max(100).optional(),
});
