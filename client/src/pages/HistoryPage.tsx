// src/pages/HistoryPage.tsx
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import VehicleSpecsCard from "../components/VehicleSpecsCard";
import SpecEditor, { type SpecDraft } from "../components/SpecEditor";
import Banner from "../components/ui/Banner";
import { saveToLedger, updateLedger, updateSpecs, type ScanResponse } from "../api/vinService";
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

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1980 + 1 }, (_, i) => currentYear - i);

  // Editable year for recording a cache-matched VIN (decoding is a heuristic).
  const [recordYear, setRecordYear] = useState<string>(() => (vehicleData?.year && /^\d{4}$/.test(vehicleData.year) ? vehicleData.year : ""));

  // Edit mode for an already-recorded ledger row.
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eMfg, setEMfg] = useState("");
  const [eModel, setEModel] = useState("");
  const [eYear, setEYear] = useState("");
  const [eImage, setEImage] = useState("");

  // Edit mode for the shared specs (keyed by WMI+VDS).
  const [editingSpecs, setEditingSpecs] = useState(false);
  const [savingSpecs, setSavingSpecs] = useState(false);
  const [specDraft, setSpecDraft] = useState<SpecDraft>({});

  const startEditSpecs = () => {
    setSpecDraft((vehicleData?.hardware_specs as SpecDraft) ?? {});
    setError("");
    setEditingSpecs(true);
  };

  const handleSaveSpecs = async () => {
    if (!vehicleData?.wmi || !vehicleData?.vds) return;
    setSavingSpecs(true);
    setError("");
    try {
      await updateSpecs({ wmi: vehicleData.wmi, vds_code: vehicleData.vds, hardware_specs: specDraft });
      const updated = { ...vehicleData, hardware_specs: specDraft };
      setEditingSpecs(false);
      navigate(`/history/${vehicleData.vin}`, { replace: true, state: { vehicleData: updated } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save specifications.");
    } finally {
      setSavingSpecs(false);
    }
  };

  const startEdit = () => {
    setEMfg(vehicleData?.manufacturer ?? "");
    setEModel(vehicleData?.model ?? "");
    setEYear(vehicleData?.year && /^\d{4}$/.test(vehicleData.year) ? vehicleData.year : "");
    setEImage(vehicleData?.image_url ?? "");
    setError("");
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!vehicleData?.vin) return;
    if (!eMfg.trim()) return setError("Manufacturer is required.");
    if (!eModel.trim()) return setError("Model is required.");
    if (!eYear) return setError("Please select a year.");

    setSaving(true);
    setError("");
    try {
      const { record } = await updateLedger(vehicleData.vin, {
        manufacturer: eMfg.trim(),
        model: eModel.trim(),
        year: eYear,
        image_url: eImage.trim() || null,
      });
      setEditing(false);
      navigate(`/history/${record.vin}`, { replace: true, state: { vehicleData: record } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

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
    if (!recordYear) {
      setError("Please select a year.");
      return;
    }

    setRecording(true);
    setError("");
    try {
      const { record } = await saveToLedger({
        vin: scanResult.vin,
        manufacturer: ref?.manufacturer || scanResult.extractedData.manufacturer,
        year: recordYear,
        model,
        hardwareSpecs: scanResult.data.hardware_specs ?? {},
        image_url: ref?.image_url ?? null,
        baseFacts: { vis: scanResult.vin.substring(9), plant: scanResult.vin.substring(10, 11) },
      });
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

  const inputCls = "p-2 border border-slate-300 rounded bg-white text-base";

  return (
    <div className="max-w-5xl mx-auto mt-10 p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 border-b pb-4 gap-4">
        <div className="flex-1">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <select value={eYear} onChange={(e) => setEYear(e.target.value)} className={`${inputCls} font-mono`}>
                <option value="" disabled>
                  Year
                </option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <input value={eMfg} onChange={(e) => setEMfg(e.target.value)} placeholder="Manufacturer" className={inputCls} />
              <input value={eModel} onChange={(e) => setEModel(e.target.value)} placeholder="Model" className={inputCls} />
            </div>
          ) : (
            <h1 className="text-3xl font-bold text-slate-800">
              {(fromCache ? recordYear : vehicleData.year) || vehicleData.year} {vehicleData.manufacturer} {vehicleData.model || (fromCache ? "" : "Unknown model")}
            </h1>
          )}
          <p className="text-slate-500 font-mono mt-1 text-lg">VIN: {vin}</p>
        </div>

        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={handleSaveEdit} disabled={saving} className="bg-green-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-green-700 disabled:bg-slate-400 transition">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditing(false)} className="border border-slate-300 text-slate-600 px-5 py-2 rounded-lg font-bold hover:bg-slate-50 transition">
                Cancel
              </button>
            </>
          ) : (
            <>
              {!fromCache && (
                <button onClick={startEdit} className="border border-orange-300 text-orange-700 px-5 py-2 rounded-lg font-bold hover:bg-orange-50 transition">
                  Edit
                </button>
              )}
              <button onClick={() => navigate("/scan")} className="bg-orange-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-700 transition">
                Scan New VIN
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <Banner variant="error">{error}</Banner>
        </div>
      )}

      {fromCache && !editing && (
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
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-slate-600">Year</label>
                <select value={recordYear} onChange={(e) => setRecordYear(e.target.value)} className="p-2 border border-slate-300 rounded bg-white font-mono text-sm">
                  <option value="" disabled>
                    Select
                  </option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleRecord}
                  disabled={recording}
                  className="bg-green-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-green-700 disabled:bg-slate-400 transition whitespace-nowrap"
                >
                  {recording ? "Recording…" : "Record this VIN"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: this specific vehicle instance */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">{fromCache ? "Decoded Identity" : "Ledger Instance"}</h2>

            {(editing ? eImage : vehicleData.image_url) ? (
              <img src={editing ? eImage : (vehicleData.image_url as string)} alt="Vehicle" className="w-full rounded-lg shadow-sm mb-4 object-cover" />
            ) : (
              <div className="w-full h-40 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 mb-4 font-medium">No Image</div>
            )}

            {editing && <input value={eImage} onChange={(e) => setEImage(e.target.value)} placeholder="Image URL (https://…)" className={`${inputCls} w-full mb-4 text-sm`} />}

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
          <div className="flex items-center justify-between mb-2 gap-3">
            <h2 className="text-2xl font-bold text-slate-800">Hardware Specifications</h2>
            {!fromCache && !editing && (
              <div className="flex gap-2">
                {editingSpecs ? (
                  <>
                    <button onClick={handleSaveSpecs} disabled={savingSpecs} className="bg-green-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-green-700 disabled:bg-slate-400 transition">
                      {savingSpecs ? "Saving…" : "Save Specs"}
                    </button>
                    <button onClick={() => setEditingSpecs(false)} className="border border-slate-300 text-slate-600 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-slate-50 transition">
                      Cancel
                    </button>
                  </>
                ) : (
                  Object.keys(vehicleData.hardware_specs ?? {}).length > 0 && (
                    <button onClick={startEditSpecs} className="border border-orange-300 text-orange-700 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-orange-50 transition">
                      Edit Specs
                    </button>
                  )
                )}
              </div>
            )}
          </div>
          <p className="text-slate-500 mb-6 text-sm">
            Shared across all vehicles with VDS code <span className="font-mono font-bold">{vehicleData.vds}</span>
            {editingSpecs ? " — changes apply to every VIN of this model." : "."}
          </p>

          {editingSpecs ? <SpecEditor specs={specDraft} onChange={setSpecDraft} /> : <VehicleSpecsCard specs={vehicleData.hardware_specs ?? {}} />}
        </div>
      </div>
    </div>
  );
}
