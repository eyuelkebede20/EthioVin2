import { Car } from "lucide-react";
import type { ExtractedData } from "../api/vinService";

interface UnknownVehicleNoticeProps {
  vin: string;
  extracted: ExtractedData;
  onScanAnother: () => void;
}

/**
 * Read-only "miss" screen for non-verifier roles. A regular user who scans a VIN
 * we have no verified specs for shouldn't see the admin verification form (its
 * actions are admin-only and would 403) — just the decoded basics and a clear
 * "not recorded yet" message.
 */
export default function UnknownVehicleNotice({ vin, extracted, onScanAnother }: UnknownVehicleNoticeProps) {
  const knownMake = extracted.manufacturer && extracted.manufacturer !== "Unknown";

  const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
    <p className="flex justify-between gap-4">
      <strong className="text-slate-500 font-semibold">{label}</strong>
      <span className={mono ? "font-mono text-slate-800" : "text-slate-800"}>{value}</span>
    </p>
  );

  return (
    <div className="max-w-2xl mx-auto mt-8 bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100">
        <Car className="h-8 w-8 text-orange-600" />
      </div>

      <h2 className="text-2xl font-bold text-slate-800">Not in our records yet</h2>
      <p className="text-slate-500 mt-2">
        We decoded this VIN, but verified specifications for this vehicle haven&apos;t been added yet.
      </p>

      <div className="mt-6 text-left bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2 text-sm">
        <Row label="VIN" value={vin} mono />
        <Row label="Make (estimated)" value={knownMake ? extracted.manufacturer : "Unknown"} />
        <Row label="Year (estimated)" value={extracted.year} mono />
        <Row label="WMI" value={extracted.wmi} mono />
        <Row label="VDS" value={extracted.vds_code} mono />
      </div>

      <p className="text-xs text-slate-400 mt-4">An administrator can add verified specifications for this model.</p>

      <button onClick={onScanAnother} className="mt-6 bg-orange-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-orange-700 transition">
        Scan another VIN
      </button>
    </div>
  );
}
