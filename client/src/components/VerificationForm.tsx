import { useState } from "react";
import type { ScanResponse } from "../api/vinService";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const IMPORT_COUNTRIES = [
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
];

const INITIAL_MANUFACTURERS = [
  "Toyota",
  "LVU Chery",
  "Hyundai",
  "Suzuki",
  "Nissan",
  "Jeep",
  "BYD",
  "Tesla",
  "Ford",
  "Chevrolet",
  "Kia",
  "Honda",
  "BMW",
  "Mercedes-Benz",
  "Volkswagen",
  "Lexus",
  "Isuzu",
  "Mitsubishi",
  "Peugeot",
  "Renault",
];

interface VerificationFormProps {
  scanData: ScanResponse;
  initialSpecs?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function VerificationForm({ scanData, initialSpecs, onSuccess, onCancel }: VerificationFormProps) {
  const cachedSpecs = scanData?.data?.vehicle_specs?.hardware_specs;
  const isCacheHit = !!cachedSpecs;

  const [aiDraft, setAiDraft] = useState<any | null>(cachedSpecs || initialSpecs?.hardware_specs || null);
  const [modelInput, setModelInput] = useState(initialSpecs?.model || scanData?.data?.vehicle_ledger?.model || "");
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [, setFetchingImages] = useState(false);

  // BULLETPROOF EXTRACTION
  const extracted = scanData?.extractedData || scanData?.data?.vds_cache || {};
  const wmi = extracted?.wmi || "Unknown";
  const vds = extracted?.vds_code || scanData?.data?.vds_cache?.vds_code || "Unknown";
  const baseManufacturer = extracted?.manufacturer || extracted?.wmi || "Unknown";
  const rawYear = extracted?.year || "Unknown";
  const vinToSave = scanData?.vin || scanData?.data?.vehicle_spec?.vin || "";

  // INLINE WMI RESOLUTION STATE
  const isUnknownWmi = baseManufacturer === "Unknown" || baseManufacturer === wmi;
  const [mfgList, setMfgList] = useState<string[]>(INITIAL_MANUFACTURERS);
  const [resolvedMfg, setResolvedMfg] = useState("");
  const [resolvedCountry, setResolvedCountry] = useState(IMPORT_COUNTRIES[0].name);

  // Add Manufacturer Modal State
  const [isAddMfgModalOpen, setIsAddMfgModalOpen] = useState(false);
  const [newMfgName, setNewMfgName] = useState("");

  const finalManufacturer = isUnknownWmi && resolvedMfg ? resolvedMfg : baseManufacturer;

  // MANUAL YEAR STATE
  const [manualYear, setManualYear] = useState<string>("");
  const finalYear = rawYear === "Unknown" ? manualYear : rawYear;

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1991 + 1 }, (_, i) => currentYear - i);
  const API_URL = import.meta.env.VITE_BACKEND_URL;

  const handleAddManufacturer = () => {
    const trimmed = newMfgName.trim();
    if (trimmed && !mfgList.includes(trimmed)) {
      setMfgList((prev) => [...prev, trimmed].sort());
      setResolvedMfg(trimmed); // Auto-select the new manufacturer
    }
    setNewMfgName("");
    setIsAddMfgModalOpen(false);
  };

  const handleGenerateAI = async () => {
    if (isUnknownWmi && !resolvedMfg) return setError("Please select a manufacturer for this unknown WMI.");
    if (!modelInput) return setError("Please enter the vehicle model.");
    if (rawYear === "Unknown" && !manualYear) return setError("Please select a valid year.");

    setProcessing(true);
    setFetchingImages(true);
    setError("");

    try {
      // 1. Fetch AI Specs
      const res = await fetch(`${API_URL}/api/v1/vin/generate-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ manufacturer: finalManufacturer, year: finalYear, model: modelInput }),
      });
      const data = await res.json();
      if (res.ok) setAiDraft(data.draft);

      // 2. Fetch Images
      const imgRes = await fetch(`${BACKEND_URL}/api/v1/vin/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ manufacturer: finalManufacturer, year: finalYear, model: modelInput }),
      });
      const imgData = await imgRes.json();
      if (imgRes.ok && imgData.images.length > 0) {
        setImages(imgData.images);
        setSelectedImage(imgData.images[0]);
      }
    } catch (e) {
      setError("Network error during generation.");
    } finally {
      setProcessing(false);
      setFetchingImages(false);
    }
  };

  const handleSave = async () => {
    if (rawYear === "Unknown" && !manualYear) return setError("Please select a valid year before saving.");
    if (isUnknownWmi && !resolvedMfg) return setError("Please select a manufacturer before saving.");

    setSaving(true);
    setError("");

    try {
      // Silently train the database on the new WMI mapping if it was unknown
      if (isUnknownWmi && resolvedMfg) {
        await fetch(`${API_URL}/api/v1/admin/wmi/update`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ wmi, manufacturer: resolvedMfg, country: resolvedCountry }),
        }).catch((err) => console.error("Silently failed to update WMI mapping", err));
      }

      const res = await fetch(`${API_URL}/api/v1/vin/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          vin: vinToSave,
          manufacturer: finalManufacturer,
          year: finalYear,
          model: modelInput,
          hardwareSpecs: aiDraft,
          baseFacts: { wmi, vds },
          image_url: selectedImage,
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

  return (
    <div className="max-w-6xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-slate-200 mt-8 relative">
      <h2 className="text-2xl font-bold mb-6">{isCacheHit ? "Verify Cached Specifications" : "Verify & Update Specifications"}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 h-fit">
          <h3 className="font-bold text-slate-700 mb-4 border-b pb-2">Base Scanned Facts</h3>
          <div className="flex flex-col gap-3 text-sm font-mono text-slate-600">
            {/* INLINE WMI RESOLUTION WIDGET */}
            <div className="flex justify-between items-start">
              <span className="mt-2">Manufacturer:</span>
              {!isUnknownWmi ? (
                <span className="mt-2">{baseManufacturer}</span>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg w-2/3 shadow-inner">
                  <div className="text-[10px] font-bold text-amber-700 uppercase mb-2 tracking-wide flex justify-between items-center">
                    <span>⚠️ Unknown WMI ({wmi})</span>
                    <button onClick={() => setIsAddMfgModalOpen(true)} className="text-blue-600 hover:text-blue-800 hover:underline px-1 py-0.5 rounded">
                      + Add Make
                    </button>
                  </div>
                  <select value={resolvedMfg} onChange={(e) => setResolvedMfg(e.target.value)} className="w-full p-1.5 mb-2 border border-amber-300 rounded text-xs font-sans text-slate-700 bg-white">
                    <option value="" disabled>
                      Select Make
                    </option>
                    {mfgList.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={resolvedCountry}
                    onChange={(e) => setResolvedCountry(e.target.value)}
                    className="w-full p-1.5 border border-amber-300 rounded text-xs font-sans text-slate-700 bg-white"
                  >
                    {IMPORT_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-2">
              <span>Year:</span>
              {rawYear === "Unknown" ? (
                <select value={manualYear} onChange={(e) => setManualYear(e.target.value)} className="p-1 border border-slate-300 rounded font-normal text-slate-700 focus:outline-blue-500 bg-white">
                  <option value="" disabled>
                    Select Year
                  </option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              ) : (
                <span>{rawYear}</span>
              )}
            </div>

            <div className="flex justify-between items-center">
              <span>WMI:</span> <span>{wmi}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>VDS:</span> <span>{vds}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <label className="font-bold text-slate-700">
            Vehicle Model
            <input
              type="text"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              disabled={isCacheHit}
              placeholder="e.g. Model Y, RAV4"
              className="w-full p-3 border rounded mt-1 font-normal focus:outline-blue-500 disabled:bg-slate-50"
            />
          </label>

          {!isCacheHit && !aiDraft && (
            <button
              onClick={handleGenerateAI}
              disabled={processing || !modelInput || (rawYear === "Unknown" && !manualYear) || (isUnknownWmi && !resolvedMfg)}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded font-bold disabled:bg-slate-400 hover:bg-blue-700 transition"
            >
              {processing ? "Generating..." : "Generate Specs Draft (AI)"}
            </button>
          )}

          {isCacheHit && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium text-center">✓ Hardware specs loaded from system DNA cache.</div>}

          {error && <div className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded border border-red-200">{error}</div>}
        </div>
      </div>

      {images.length > 0 && (
        <div className="border-t pt-6 mb-8 animate-fade-in">
          <h3 className="font-bold text-xl mb-4 text-slate-800">Select Vehicle Image</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {images.map((imgUrl, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedImage(imgUrl)}
                className={`cursor-pointer rounded-xl overflow-hidden border-4 transition-all ${
                  selectedImage === imgUrl ? "border-blue-500 scale-105 shadow-lg" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img src={imgUrl} alt={`Option ${idx + 1}`} className="w-full h-32 object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {aiDraft && (
        <div className="border-t pt-6 animate-fade-in">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-500 flex flex-col">
                  Gearbox
                  <select
                    value={aiDraft.transmission?.gearbox || ""}
                    onChange={(e) => updateDraft("transmission", "gearbox", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1 bg-white"
                  >
                    <option value="">Select Gearbox</option>
                    <option value="Automatic">Automatic</option>
                    <option value="Manual">Manual</option>
                    <option value="CVT">CVT</option>
                    <option value="Dual Clutch">Dual Clutch</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-500 flex flex-col">
                  Type
                  <select
                    value={aiDraft.transmission?.type || ""}
                    onChange={(e) => updateDraft("transmission", "type", e.target.value)}
                    className="w-full p-2 border rounded font-normal mt-1 bg-white"
                  >
                    <option value="">Select Type</option>
                    <option value="FWD">FWD</option>
                    <option value="RWD">RWD</option>
                    <option value="AWD">AWD</option>
                    <option value="4WD">4WD</option>
                  </select>
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
            <button onClick={onCancel} className="px-6 py-3 border border-slate-300 rounded font-bold text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-3 bg-green-600 text-white rounded font-bold hover:bg-green-700 disabled:bg-slate-400 transition shadow-md">
              {saving ? "Saving..." : "Save to Database"}
            </button>
          </div>
        </div>
      )}

      {/* Add Manufacturer Modal */}
      {isAddMfgModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4 text-slate-800">Add New Manufacturer</h3>
            <input
              type="text"
              value={newMfgName}
              onChange={(e) => setNewMfgName(e.target.value)}
              placeholder="e.g. Rivian"
              className="w-full p-3 border border-slate-300 rounded mb-6 focus:outline-blue-500 font-normal"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddManufacturer()}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsAddMfgModalOpen(false);
                  setNewMfgName("");
                }}
                className="px-4 py-2 border border-slate-300 rounded font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button onClick={handleAddManufacturer} disabled={!newMfgName.trim()} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:bg-slate-400 transition">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
