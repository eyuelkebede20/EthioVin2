import { z } from "zod";

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

// NOTE: there is deliberately no shared "VIN field" validator here. VINs are
// validated + parsed by parseVin() (utils/vin.ts), which must KEEP I/O/Q to
// decode the model year correctly; a generic refine that strips/rejects those
// letters would shift positions and mis-read the year. Request schemas that take
// a VIN use a plain bounded string and defer to parseVin().

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

// VIN parsing/validation is handled by parseVin() (it must keep I/O/Q to decode
// the year correctly), so the schema only checks that a string was sent.
export const scanSchema = z.object({ vin: z.string().min(1).max(40) });

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
  vin: z.string().min(1).max(40), // parsed/validated by parseVin()
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

// Bulk-add: a list of VINs to auto-record against the DNA cache. 1..100 bounded
// strings; parseVin is the per-item authority (I/O/Q kept). No specs here — the
// endpoint only records VINs whose model is ALREADY known (cache/exact hit).
export const BULK_LOG_MAX = 100;
export const bulkLogSchema = z.object({
  vins: z.array(z.string().min(1).max(40)).min(1).max(BULK_LOG_MAX),
});

// Edit an existing ledger row's identity fields. All optional (partial update);
// image_url accepts a string or null (null/empty clears the image).
export const updateLedgerSchema = z.object({
  manufacturer: shortText.optional(),
  year: yearField.optional(),
  model: shortText.optional(),
  image_url: z.union([z.string().max(2048), z.null()]).optional(),
});

export const updateWmiSchema = z.object({
  wmi: wmiField,
  manufacturer: shortText,
  country: z.string().trim().max(100).optional(),
});

// ---------------------------------------------------------------------------
// Milestone 2 — request schemas (orgs, garage, insurance, payments)
// ---------------------------------------------------------------------------

// A bounded VIN string; the canonical key is derived by parseVin() in the
// controller (NOT a refine — that would strip/reject I/O/Q and shift positions).
const vinInput = z.string().min(1).max(40);

// Email without z.string().email()/datetime() (deprecated in zod 4) — plain refine.
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .refine((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s), "invalid email");

const orgIdField = z.string().trim().min(1).max(80);

export const ORG_TYPES = ["garage", "insurer", "diagnostic"] as const;
export const JOB_STATUSES = ["intake", "in_progress", "awaiting_parts", "done", "delivered", "cancelled"] as const;

// --- Org onboarding (super_admin) ---
export const createOrgSchema = z.object({
  name: shortText,
  type: z.enum(ORG_TYPES),
  country: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
});

export const addOrgMemberSchema = z.object({
  orgId: orgIdField,
  email: emailField,
  orgRole: z.string().trim().max(40).optional(),
});

export const dataSharingAgreementSchema = z.object({
  orgId: orgIdField,
  scope: z.record(z.string(), z.unknown()).refine((v) => Object.keys(v).length > 0, "scope must not be empty"),
});

// --- Contributor inputs ---
export const odometerReadingSchema = z.object({
  vin: vinInput,
  readingKm: z.coerce.number().int().min(0).max(10_000_000),
  readAt: z.coerce.date().optional(),
  source: z.string().trim().max(40).optional(),
});

// MINIMIZATION GATE (intake): only these fields are accepted. Any extra fields an
// insurer sends (claim narrative, claimant PII, amounts, documents) are dropped by
// zod's default strip and NEVER persisted. This IS the inbound privacy boundary (§3b).
export const insuranceClaimIntakeSchema = z.object({
  vin: vinInput,
  incidentType: z.string().trim().min(1).max(40),
  severityBand: z.coerce.number().int().min(1).max(5),
  incidentDate: z.coerce.date().optional(),
  payoutBand: z.string().trim().max(20).optional(),
});

export const policeReportIntakeSchema = z.object({
  vin: vinInput,
  reportRef: z.string().trim().max(100).optional(),
  incidentType: z.string().trim().min(1).max(40),
  severityBand: z.coerce.number().int().min(1).max(5).optional(),
  incidentDate: z.coerce.date().optional(),
});

// --- Garage management ---
export const customerSchema = z.object({
  name: shortText,
  phone: z.string().trim().max(40).optional(),
});

export const garageJobItemSchema = z.object({
  kind: z.enum(["labor", "part"]),
  description: z.string().trim().min(1).max(300),
  qty: z.coerce.number().min(0).max(100_000).default(1),
  unitCost: z.coerce.number().min(0).max(100_000_000).default(0),
});

export const createGarageJobSchema = z.object({
  vin: vinInput.optional(),
  customerId: z.string().trim().max(80).optional(),
  odometerIn: z.coerce.number().int().min(0).max(10_000_000).optional(),
  items: z.array(garageJobItemSchema).max(200).optional(),
});

export const updateGarageJobSchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  odometerIn: z.coerce.number().int().min(0).max(10_000_000).optional(),
  items: z.array(garageJobItemSchema).max(200).optional(),
});

export const APPOINTMENT_STATUSES = ["scheduled", "confirmed", "done", "cancelled"] as const;

export const appointmentSchema = z.object({
  vin: vinInput.optional(),
  customerId: z.string().trim().max(80).optional(),
  scheduledAt: z.coerce.date(),
});

export const updateAppointmentSchema = z.object({
  scheduledAt: z.coerce.date().optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});

export const partSchema = z.object({
  name: shortText,
  sku: z.string().trim().max(80).optional(),
  qtyOnHand: z.coerce.number().int().min(0).max(1_000_000).default(0),
  reorderLevel: z.coerce.number().int().min(0).max(1_000_000).default(0),
  unitCost: z.coerce.number().min(0).max(100_000_000).default(0),
});

// All fields optional. `qtyDelta` adjusts stock relative to current (e.g. -2 on
// use, +50 on restock); absolute `qtyOnHand` is also accepted. Use one or the other.
export const updatePartSchema = z.object({
  name: shortText.optional(),
  sku: z.string().trim().max(80).optional(),
  qtyOnHand: z.coerce.number().int().min(0).max(1_000_000).optional(),
  qtyDelta: z.coerce.number().int().min(-1_000_000).max(1_000_000).optional(),
  reorderLevel: z.coerce.number().int().min(0).max(1_000_000).optional(),
  unitCost: z.coerce.number().min(0).max(100_000_000).optional(),
});

// --- Payments ---
export const paymentInitSchema = z.object({
  amount: z.coerce.number().positive().max(10_000_000),
  provider: z.string().trim().min(1).max(40),
});

// --- Admin settings (feature flags) ---
export const updateSettingsSchema = z
  .object({
    paymentsEnabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No settings to update");

// ---------------------------------------------------------------------------
// Milestone 3 — public API platform (see claude.milestone3.md)
// ---------------------------------------------------------------------------

// Public POST /v1/decode body. Like scanSchema: a bounded plain string that
// defers to parseVin() — NO I/O/Q rejection here (parseVin is the authority).
export const publicDecodeSchema = z.object({ vin: z.string().min(1).max(40) });

// Public POST /v1/decode/batch body. 1..50 VINs; each element is a bounded plain
// string that defers to parseVin() per-item (same rule as the single decode).
export const BATCH_DECODE_MAX = 50;
export const publicDecodeBatchSchema = z.object({
  vins: z.array(z.string().min(1).max(40)).min(1).max(BATCH_DECODE_MAX),
});

// Dev portal: create an API key. Name is a human label for the dashboard.
export const createKeySchema = z.object({
  name: z.string().trim().min(1).max(64),
});

// Dev portal: start a Chapa checkout for a credit pack. packId is validated
// against lib/pricing.ts in the controller (not enumerated here).
export const checkoutSchema = z.object({
  packId: z.string().trim().min(1).max(32),
});

// Dev portal: redeem a promo code. Normalized (trim + UPPERCASE) so lookups match.
export const promoRedeemSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .transform((s) => s.toUpperCase()),
});

// Admin: create a promo code. `code` optional — omitted => server-generated.
export const createPromoSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .transform((s) => s.toUpperCase())
    .optional(),
  credits: z.coerce.number().int().positive().max(1_000_000),
  maxRedemptions: z.coerce.number().int().positive().max(10_000_000).optional(),
  perAccountLimit: z.coerce.number().int().positive().max(1000).optional(),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  note: z.string().trim().max(200).optional(),
});

// Admin: manual credit grant. Target by ownerId OR email (one required).
export const adminGrantSchema = z
  .object({
    ownerId: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    amount: z.coerce.number().int().positive().max(10_000_000),
    note: z.string().trim().max(200).optional(),
  })
  .refine((v) => !!(v.ownerId || v.email), "ownerId or email is required");

// Admin: override a key's per-minute rate limit (enterprise deals).
export const updateKeyLimitSchema = z.object({
  rateLimitPerMin: z.coerce.number().int().min(1).max(100_000),
});

// Admin: edit credit-pack pricing + the free signup grant (stored in app_settings).
export const updatePricingSchema = z.object({
  packs: z
    .array(
      z.object({
        packId: z
          .string()
          .trim()
          .min(1)
          .max(32)
          .regex(/^[a-z0-9_-]+$/i, "packId may only contain letters, numbers, - and _"),
        credits: z.coerce.number().int().positive().max(10_000_000),
        priceEtb: z.coerce.number().nonnegative().max(100_000_000),
        note: z.string().trim().max(100).default(""),
      }),
    )
    .min(1)
    .max(12),
  signupGrantCredits: z.coerce.number().int().nonnegative().max(10_000_000),
});

// GET /v1/usage query range. Dates as YYYY-MM-DD strings; range bounded in the controller.
export const usageRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD").optional(),
});
