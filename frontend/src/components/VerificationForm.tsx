import { useState } from "react";

// Adjust this type to match your actual API response
export interface ScanResponse {
  hit: boolean;
  promptAdmin?: boolean;
  extractedData?: {
    wmi: string;
    vds_code: string;
    year: number;
    manufacturer: string;
  };
  data?: any;
  vin?: string;
}

interface VerificationFormProps {
  scanData: ScanResponse;
  initialSpecs?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function VerificationForm({ scanData, initialSpecs, onSuccess, onCancel }: VerificationFormProps) {
  const [modelInput, setModelInput] = useState(initialSpecs?.model || "");
  const [aiDraft, setAiDraft] = useState<any | null>(initialSpecs?.hardware_specs || null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const extracted = scanData?.extractedData || scanData?.data?.vds_cache;
  const manufacturer = extracted?.manufacturer || extracted?.wmi;
  const year = extracted?.year;

  const handleGenerateAI = async () => {
    if (!modelInput) return setError("Please enter the vehicle model.");
    setProcessing(true);
    setError("");

    try {
      const res = await fetch("http://localhost:3000/api/v1/vin/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ manufacturer, year, model: modelInput }),
      });
      const data = await res.json();

      if (res.ok) {
        setAiDraft(data.draft);
      } else {
        setError(data.error || "Failed to generate draft.");
      }
    } catch (e) {
      setError("Network error during AI generation.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      const res = await fetch("http://localhost:3000/api/v1/vin/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vin: scanData.vin || scanData.data?.vehicle_spec?.vin,
          manufacturer,
          year,
          model: modelInput,
          hardwareSpecs: aiDraft,
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save verification.");
      }
    } catch (e) {
      setError("Network error during save.");
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (section: string, field: string, value: string | number) => {
    setAiDraft((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };
  const sections = [
    {
      title: "Engine",
      color: "red",
      key: "engine",
      fields: [
        { label: "Engine Model", name: "engineModel", type: "text" },
        { label: "Fuel Type", name: "fuelType", type: "text" },
        { label: "Emission Standard", name: "emissionStandard", type: "text" },
        { label: "Fuel Consumption", name: "fuelConsumption", type: "text" },
      ],
    },
    {
      title: "Transmission",
      color: "blue",
      key: "transmission",
      fields: [
        { label: "Gearbox", name: "gearbox", type: "text" },
        { label: "Type", name: "type", type: "text" },
        { label: "Speeds", name: "speeds", type: "number" },
        { label: "Drive Type", name: "driveType", type: "text" },
      ],
    },
    // ...continue same pattern
  ];
  return (
    <div className="max-w-6xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-slate-200 mt-8">
      <h2 className="text-2xl font-bold mb-6">Verify & Update Specifications</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-4 border-b pb-2">Base Scanned Facts</h3>
          <div className="flex flex-col gap-2 text-sm font-mono text-slate-600">
            <div className="flex justify-between">
              <span>Manufacturer:</span> <span>{manufacturer}</span>
            </div>
            <div className="flex justify-between">
              <span>Year:</span> <span>{year}</span>
            </div>
            <div className="flex justify-between">
              <span>WMI:</span> <span>{extracted?.wmi}</span>
            </div>
            <div className="flex justify-between">
              <span>VDS:</span> <span>{extracted?.vds_code || extracted?.vds}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <label className="font-bold text-slate-700">
            Vehicle Model
            <input type="text" value={modelInput} onChange={(e) => setModelInput(e.target.value)} placeholder="e.g. Model Y, RAV4" className="w-full p-3 border rounded mt-1 font-normal" />
          </label>
          <button onClick={handleGenerateAI} disabled={processing || !modelInput} className="w-full bg-blue-600 text-white px-4 py-3 rounded font-bold disabled:bg-slate-400 hover:bg-blue-700">
            {processing ? "Generating..." : "Generate Specs Draft (AI)"}
          </button>
          {error && <div className="text-red-600 text-sm font-bold bg-red-50 p-2 rounded">{error}</div>}
        </div>
      </div>

      {aiDraft && (
        <div className="border-t pt-6">
          <h3 className="font-bold text-xl mb-4 text-slate-800">Hardware Specifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-4 border rounded bg-red-50/30">
              <h4 className="font-bold text-red-700 mb-3">Engine</h4>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500">
                  Engine Model
                  <input
                    type="text"
                    value={aiDraft.engine?.engineModel || ""}
                    onChange={(e) => updateDraft("engine", "engineModel", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Fuel Type
                  <input
                    type="text"
                    value={aiDraft.engine?.fuelType || ""}
                    onChange={(e) => updateDraft("engine", "fuelType", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Emission Standard
                  <input
                    type="text"
                    value={aiDraft.engine?.emissionStandard || ""}
                    onChange={(e) => updateDraft("engine", "emissionStandard", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Fuel Consumption
                  <input
                    type="text"
                    value={aiDraft.engine?.fuelConsumption || ""}
                    onChange={(e) => updateDraft("engine", "fuelConsumption", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
              </div>
            </div>

            <div className="p-4 border rounded bg-blue-50/30">
              <h4 className="font-bold text-blue-700 mb-3">Transmission</h4>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500">
                  Gearbox
                  <input
                    type="text"
                    value={aiDraft.transmission?.gearbox || ""}
                    onChange={(e) => updateDraft("transmission", "gearbox", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Type
                  <input
                    type="text"
                    value={aiDraft.transmission?.type || ""}
                    onChange={(e) => updateDraft("transmission", "type", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Speeds
                  <input
                    type="number"
                    value={aiDraft.transmission?.speeds || ""}
                    onChange={(e) => updateDraft("transmission", "speeds", parseInt(e.target.value))}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Drive Type
                  <input
                    type="text"
                    value={aiDraft.transmission?.driveType || ""}
                    onChange={(e) => updateDraft("transmission", "driveType", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
              </div>
            </div>

            <div className="p-4 border rounded bg-yellow-50/30">
              <h4 className="font-bold text-yellow-700 mb-3">Weight & Capacity</h4>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500">
                  Curb Weight
                  <input
                    type="text"
                    value={aiDraft.weightAndCapacity?.curbWeight || ""}
                    onChange={(e) => updateDraft("weightAndCapacity", "curbWeight", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Seats
                  <input
                    type="number"
                    value={aiDraft.weightAndCapacity?.seats || ""}
                    onChange={(e) => updateDraft("weightAndCapacity", "seats", parseInt(e.target.value))}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Doors
                  <input
                    type="number"
                    value={aiDraft.weightAndCapacity?.doors || ""}
                    onChange={(e) => updateDraft("weightAndCapacity", "doors", parseInt(e.target.value))}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
              </div>
            </div>

            <div className="p-4 border rounded bg-green-50/30">
              <h4 className="font-bold text-green-700 mb-3">Dimensions</h4>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold text-slate-500">
                  Length
                  <input
                    type="text"
                    value={aiDraft.dimensions?.length || ""}
                    onChange={(e) => updateDraft("dimensions", "length", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Width
                  <input
                    type="text"
                    value={aiDraft.dimensions?.width || ""}
                    onChange={(e) => updateDraft("dimensions", "width", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Height
                  <input
                    type="text"
                    value={aiDraft.dimensions?.height || ""}
                    onChange={(e) => updateDraft("dimensions", "height", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Wheelbase
                  <input
                    type="text"
                    value={aiDraft.dimensions?.wheelbase || ""}
                    onChange={(e) => updateDraft("dimensions", "wheelbase", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Front Track
                  <input
                    type="text"
                    value={aiDraft.dimensions?.frontTrack || ""}
                    onChange={(e) => updateDraft("dimensions", "frontTrack", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Rear Track
                  <input
                    type="text"
                    value={aiDraft.dimensions?.rearTrack || ""}
                    onChange={(e) => updateDraft("dimensions", "rearTrack", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
              </div>
            </div>

            <div className="p-4 border rounded bg-purple-50/30">
              <h4 className="font-bold text-purple-700 mb-3">Tires & Chassis</h4>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500">
                  Front Tire
                  <input
                    type="text"
                    value={aiDraft.tiresAndChassis?.frontTire || ""}
                    onChange={(e) => updateDraft("tiresAndChassis", "frontTire", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Rear Tire
                  <input
                    type="text"
                    value={aiDraft.tiresAndChassis?.rearTire || ""}
                    onChange={(e) => updateDraft("tiresAndChassis", "rearTire", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
              </div>
            </div>

            <div className="p-4 border rounded bg-pink-50/30">
              <h4 className="font-bold text-pink-700 mb-3">Classification & Market</h4>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500">
                  Body Style
                  <input
                    type="text"
                    value={aiDraft.classification?.bodyStyle || ""}
                    onChange={(e) => updateDraft("classification", "bodyStyle", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  Vehicle Class
                  <input
                    type="text"
                    value={aiDraft.classification?.vehicleClass || ""}
                    onChange={(e) => updateDraft("classification", "vehicleClass", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500">
                  MSRP
                  <input
                    type="text"
                    value={aiDraft.marketInformation?.msrp || ""}
                    onChange={(e) => updateDraft("marketInformation", "msrp", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-8">
            <button onClick={onCancel} className="px-6 py-3 border border-slate-300 rounded font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-3 bg-green-600 text-white rounded font-bold hover:bg-green-700 disabled:bg-slate-400">
              {saving ? "Saving..." : "Save to Database"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
