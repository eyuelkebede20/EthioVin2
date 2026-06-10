// src/pages/HistoryPage.tsx
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import VehicleSpecsCard from "../components/VehicleSpecsCard";
import Banner from "../components/ui/Banner";
import { saveToLedger, type ScanResponse } from "../api/vinService";
import { ApiError } from "../api/client";

interface VehicleView {
  vin?: string;
  manufacturer?: string;
  year?: string;
  model?: string;
  image_url?: string | null;
  wmi?: string;
  vds?: string;
  vis?: string | null;
  country?: string | null;
  scannedBy?: string | null;
  hardware_specs?: Record<string, unknown>;
}

export default function HistoryPage() {
  const { vin } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as { vehicleData?: VehicleView; fromCache?: boolean; scanResult?: ScanResponse & { vin: string } } | null;
  const vehicleData = state?.vehicleData;
  const fromCache = state?.fromCache ?? false;
  const scanResult = state?.scanResult;

  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");

  const handleRecord = async () => {
    // Only cache hits carry a scanResult here (ledger hits don't reach this flow).
    if (!scanResult || !scanResult.hit || scanResult.patientExists) return;
    const ref = scanResult.reference;
    const model = ref?.model || vehicleData?.model || "";

    // No shared model known yet — fall back to the full verification form.
    if (!model) {
      navigate("/scan", { state: { resumeScan: scanResult } });
      return;
    }

    setRecording(true);
    setError("");
    try {
      const { record } = await saveToLedger({
        vin: scanResult.vin,
        manufacturer: ref?.manufacturer || scanResult.extractedData.manufacturer,
        year: scanResult.extractedData.year !== "Unknown" ? scanResult.extractedData.year : ref?.year || "Unknown",
        model,
        hardwareSpecs: scanResult.data.hardware_specs ?? {},
        image_url: ref?.image_url ?? null,
        baseFacts: { vis: scanResult.vin.substring(9), plant: scanResult.vin.substring(10, 11) },
      });
      // Re-render as a recorded ledger instance (no longer a cache view).
      navigate(`/history/${record.vin}`, { state: { vehicleData: record } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to record this VIN.");
    } finally {
      setRecording(false);
    }
  };

  if (!vehicleData) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-xl font-bold text-red-500">No data found in memory.</h2>
        <button onClick={() => navigate("/scan")} className="mt-4 text-orange-500 underline">
          Go back to Scanner
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-10 p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            {vehicleData.year} {vehicleData.manufacturer} {vehicleData.model || (fromCache ? "" : "Unknown model")}
          </h1>
          <p className="text-slate-500 font-mono mt-1 text-lg">VIN: {vin}</p>
        </div>
        <button onClick={() => navigate("/scan")} className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-700 transition">
          Scan New VIN
        </button>
      </div>

      {fromCache && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <Banner variant="info">
                Model, image &amp; specs are shared by every VIN with WMI+VDS{" "}
                <span className="font-mono font-bold">
                  {vehicleData.wmi}/{vehicleData.vds}
                </span>
                . This exact VIN isn't recorded in the ledger yet.
              </Banner>
            </div>
            {scanResult && (
              <button
                onClick={handleRecord}
                disabled={recording}
                className="bg-green-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-green-700 disabled:bg-slate-400 transition whitespace-nowrap"
              >
                {recording ? "Recording…" : "Record this VIN"}
              </button>
            )}
          </div>
          {error && <Banner variant="error">{error}</Banner>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: this specific vehicle instance */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">{fromCache ? "Decoded Identity" : "Ledger Instance"}</h2>

            {vehicleData.image_url ? (
              <img src={vehicleData.image_url} alt="Vehicle" className="w-full rounded-lg shadow-sm mb-4 object-cover" />
            ) : (
              <div className="w-full h-40 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 mb-4 font-medium">No Image</div>
            )}

            <div className="space-y-2 text-sm text-slate-600">
              {!fromCache && (
                <p className="flex justify-between">
                  <strong>Scanned By:</strong> <span>{vehicleData.scannedBy || "System Admin"}</span>
                </p>
              )}
              <p className="flex justify-between">
                <strong>WMI (Make):</strong> <span className="font-mono">{vehicleData.wmi}</span>
              </p>
              <p className="flex justify-between">
                <strong>VDS (Hardware):</strong> <span className="font-mono">{vehicleData.vds}</span>
              </p>
              <p className="flex justify-between">
                <strong>VIS (Serial):</strong> <span className="font-mono">{vehicleData.vis || "—"}</span>
              </p>
              <p className="flex justify-between">
                <strong>Country:</strong> <span>{vehicleData.country || "—"}</span>
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: shared hardware specs (the DNA) */}
        <div className="lg:col-span-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Hardware Specifications</h2>
          <p className="text-slate-500 mb-6 text-sm">
            Shared across all vehicles with VDS code <span className="font-mono font-bold">{vehicleData.vds}</span>.
          </p>

          <VehicleSpecsCard specs={vehicleData.hardware_specs ?? {}} />
        </div>
      </div>
    </div>
  );
}
