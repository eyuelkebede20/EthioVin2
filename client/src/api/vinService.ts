import { api } from "./client";

// ---------------------------------------------------------------------------
// Shared types (mirror the backend response shapes)
// ---------------------------------------------------------------------------

export type HardwareSpecs = Record<string, unknown>;

export interface ExtractedData {
  wmi: string;
  vds_code: string;
  year: string;
  manufacturer: string;
}

export interface SuggestedModel {
  id: number;
  make: string;
  model: string;
}

export interface LedgerRecord {
  id: string;
  vin: string;
  manufacturer: string;
  year: string;
  model: string;
  image_url: string | null;
  wmi: string | null;
  vds: string | null;
  vis: string | null;
  plant: string | null;
  country: string | null;
  hardware_specs: HardwareSpecs;
  scannedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Exact VIN already in the ledger. */
export interface ScanLedgerHit {
  hit: true;
  patientExists: true;
  data: LedgerRecord;
}

/** A (wmi, vds_code) DNA cache hit — specs flattened to data.hardware_specs. */
export interface ScanCacheHit {
  hit: true;
  patientExists: false;
  extractedData: ExtractedData;
  data: {
    wmi: string;
    vds_code: string;
    spec_id: number;
    status: string;
    created_at: string;
    updated_at: string;
    hardware_specs: HardwareSpecs | null;
  };
}

/** Miss — show the admin verification form. */
export interface ScanMiss {
  hit: false;
  patientExists: false;
  promptAdmin: true;
  extractedData: ExtractedData;
  suggestedModels: SuggestedModel[];
}

export type ScanResponse = ScanLedgerHit | ScanCacheHit | ScanMiss;

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const scanVin = (vin: string) => api<ScanResponse>("/api/v1/vin/scan", { method: "POST", body: { vin } });

export const generateDraft = (input: { manufacturer: string; year: string; model: string }) =>
  api<{ draft: HardwareSpecs }>("/api/v1/vin/generate-draft", { method: "POST", body: input });

export const getVehicleImages = (input: { manufacturer: string; year?: string; model: string; startIndex?: number }) =>
  api<{ images: string[] }>("/api/v1/vin/images", { method: "POST", body: input });

export interface SaveLedgerInput {
  vin: string;
  manufacturer: string;
  year: string;
  model: string;
  hardwareSpecs: HardwareSpecs;
  image_url?: string | null;
  baseFacts?: { vis?: string; plant?: string; country?: string };
}

export const saveToLedger = (input: SaveLedgerInput) =>
  api<{ success: boolean; record: LedgerRecord }>("/api/v1/vin/log", { method: "POST", body: input });

export const submitVerifiedSpec = (input: { wmi: string; vds_code: string; hardware_specs: HardwareSpecs }) =>
  api<{ success: boolean }>("/api/v1/vin/verify", { method: "POST", body: input });

export const getConflicts = () => api<ConflictJoinRow[]>("/api/v1/vin/conflicts");

export const resolveConflict = (input: { wmi: string; vds_code: string; selected_spec_id: number }) =>
  api<{ success: boolean }>("/api/v1/vin/resolve", { method: "POST", body: input });

/** Raw join row returned by GET /conflicts (vds_cache ⋈ verification_log ⋈ vehicle_specs). */
export interface ConflictJoinRow {
  vds_cache: { wmi: string; vds_code: string; spec_id: number; status: string };
  verification_log: { id: number; admin_id: string; proposed_spec_id: number; timestamp: string } | null;
  vehicle_specs: { id: number; hardware_specs: HardwareSpecs } | null;
}
