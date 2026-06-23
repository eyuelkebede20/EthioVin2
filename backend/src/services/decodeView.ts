// decodeView — the SINGLE place the free vs premium split is decided.
//
// Free tier  : identity (make/model/year/image + decoded wmi/vds/vis) + a curated
//              BASIC spec teaser + a count of how much history exists (no detail).
// Premium    : full hardware_specs blob + the full vehicle history.
//
// One function, one tier param (req.tier from requireTier). Keeping this pure (no
// DB, no req) makes the boundary testable and impossible to bypass from the client:
// a free request literally never gets premium fields built into its response.

export type Tier = "free" | "premium";

export interface VehicleIdentity {
  vin: string;
  manufacturer?: string | null;
  model?: string | null;
  year?: string | null;
  image_url?: string | null;
  wmi?: string | null;
  vds?: string | null;
  vis?: string | null;
  country?: string | null;
}

type Specs = Record<string, unknown> | null | undefined;

// The only spec fields shown on the free tier. Section -> allowed field names.
// Everything else (full engine detail, dimensions, tires, EV pack, estimated
// market value, ...) is premium-only.
const FREE_SPEC_FIELDS: Record<string, string[]> = {
  engine: ["fuelType"],
  transmission: ["type", "driveType"],
  classification: ["bodyStyle", "vehicleClass"],
  weightAndCapacity: ["seats", "doors"],
};

function pickBasicSpecs(specs: Specs): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  if (!specs || typeof specs !== "object") return out;
  for (const [section, allowed] of Object.entries(FREE_SPEC_FIELDS)) {
    const sec = (specs as Record<string, unknown>)[section];
    if (!sec || typeof sec !== "object") continue;
    const picked: Record<string, unknown> = {};
    for (const f of allowed) {
      const v = (sec as Record<string, unknown>)[f];
      if (v !== undefined && v !== null && v !== "") picked[f] = v;
    }
    if (Object.keys(picked).length) out[section] = picked;
  }
  return out;
}

export interface FreeDecodeView {
  tier: "free";
  vehicle: VehicleIdentity;
  specs: Record<string, Record<string, unknown>>; // basic teaser only
  historyAvailable: number; // count only — unlock with premium
  premiumLocked: true;
}

export interface PremiumDecodeView {
  tier: "premium";
  vehicle: VehicleIdentity;
  specs: Record<string, unknown>; // full blob
  history: unknown[]; // full vehicle_events
}

export type DecodeView = FreeDecodeView | PremiumDecodeView;

/**
 * Build the tier-appropriate decode response. `history` is the full event list;
 * on the free tier only its COUNT crosses the boundary, never the events.
 */
export function buildDecodeView(args: { identity: VehicleIdentity; specs: Specs; history?: unknown[]; tier: Tier }): DecodeView {
  const { identity, specs, history = [], tier } = args;

  if (tier === "premium") {
    return {
      tier: "premium",
      vehicle: identity,
      specs: (specs && typeof specs === "object" ? (specs as Record<string, unknown>) : {}),
      history,
    };
  }

  return {
    tier: "free",
    vehicle: identity,
    specs: pickBasicSpecs(specs),
    historyAvailable: history.length,
    premiumLocked: true,
  };
}
