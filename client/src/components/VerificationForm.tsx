import { useState } from "react";
import type { ScanResponse, ScanCacheHit, ScanMiss, HardwareSpecs } from "../api/vinService";
import { generateDraft, getVehicleImages, saveToLedger } from "../api/vinService";
import { ApiError } from "../api/client";
import { IMPORT_COUNTRIES, DEFAULT_MANUFACTURERS } from "../lib/constants";
import Banner from "./ui/Banner";

type DraftSpecs = Record<string, Record<string, string | number>>;

const humanize = (s: string) =>
  s
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

interface VerificationFormProps {
  scanData: ScanResponse & { vin: string };
  onSuccess: () => void;
  onCancel: () => void;
}

export default function VerificationForm({ scanData, onSuccess, onCancel }: VerificationFormProps) {
  // The parent only renders this form for cache hits / misses (never ledger hits).
  const data = scanData as (ScanCacheHit | ScanMiss) & { vin: string };

  const isCacheHit = data.hit; // ScanCacheHit -> true, ScanMiss -> false
  const cachedSpecs: HardwareSpecs | null = data.hit ? data.data.hardware_specs : null;
  const { wmi, vds_code: vds, manufacturer: baseManufacturer, year: rawYear } = data.extractedData;
  const vin = data.vin;

  const [aiDraft, setAiDraft] = useState<DraftSpecs | null>((cachedSpecs as DraftSpecs | null) ?? null);
  const [modelInput, setModelInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>("");
  // Why the photo picker is empty — surfaced instead of silently swallowed, so a
  // failed image search (bad/missing SERPER key, no matches, network) is visible.
  const [imageNotice, setImageNotice] = useState<string>("");

  // Unknown-WMI inline resolution.
  const isUnknownWmi = baseManufacturer === "Unknown";
  const [mfgList, setMfgList] = useState<string[]>(DEFAULT_MANUFACTURERS);
  const [resolvedMfg, setResolvedMfg] = useState("");
  const [resolvedCountry, setResolvedCountry] = useState(IMPORT_COUNTRIES[0]!.name);
  const [isAddMfgOpen, setIsAddMfgOpen] = useState(false);
  const [newMfgName, setNewMfgName] = useState("");

  const finalManufacturer = isUnknownWmi ? resolvedMfg : baseManufacturer;

  // Year is always editable (VIN decoding is a heuristic and can be wrong). It
  // defaults to the decoded year when that looks valid, otherwise blank.
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1980 + 1 }, (_, i) => currentYear - i);
  const decodedYear = /^\d{4}$/.test(rawYear) ? rawYear : "";
  const [selectedYear, setSelectedYear] = useState<string>(decodedYear);
  const finalYear = selectedYear;

  const handleAddManufacturer = () => {
    const trimmed = newMfgName.trim();
    if (trimmed && !mfgList.includes(trimmed)) {
      setMfgList((prev) => [...prev, trimmed].sort());
      setResolvedMfg(trimmed);
    }
    setNewMfgName("");
    setIsAddMfgOpen(false);
  };

  const validate = (): string | null => {
    if (isUnknownWmi && !resolvedMfg) return "Please select a manufacturer for this unknown WMI.";
    if (!modelInput.trim()) return "Please enter the vehicle model.";
    if (!selectedYear) return "Please select a year.";
    return null;
  };

  const handleGenerateAI = async () => {
    const problem = validate();
    if (problem) return setError(problem);

    setProcessing(true);
    setError("");
    setImageNotice("");
    try {
      // Fetch specs + photos together. The photo search is captured (not swallowed)
      // so a failure shows a reason instead of an empty picker with no explanation.
      const imgArgs = { manufacturer: finalManufacturer, year: finalYear, model: modelInput.trim() };
      const [{ draft }, imgOutcome] = await Promise.all([
        generateDraft({ manufacturer: finalManufacturer, year: finalYear, model: modelInput.trim() }),
        getVehicleImages(imgArgs)
          .then((r) => ({ ok: true as const, images: r.images }))
          .catch((err) => ({ ok: false as const, images: [] as string[], err })),
      ]);
      setAiDraft(draft as DraftSpecs);
      if (imgOutcome.images.length > 0) {
        setImages(imgOutcome.images);
        setSelectedImage(imgOutcome.images[0]!);
      } else if (!imgOutcome.ok) {
        setImageNotice(
          `Couldn't load photos: ${imgOutcome.err instanceof ApiError ? imgOutcome.err.message : "image search failed"}. You can still save and add a photo later.`,
        );
      } else {
        setImageNotice("No photos found for this make / model / year — you can save now and add one later.");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to generate specifications.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = async () => {
    const problem = validate();
    if (problem) return setError(problem);
    if (!aiDraft) return setError("Generate or load specifications before saving.");

    setSaving(true);
    setError("");
    try {
      await saveToLedger({
        vin,
        manufacturer: finalManufacturer,
        year: finalYear,
        model: modelInput.trim(),
        hardwareSpecs: aiDraft,
        image_url: selectedImage || null,
        baseFacts: {
          vis: vin.substring(9),
          plant: vin.substring(10, 11),
          ...(isUnknownWmi ? { country: resolvedCountry } : {}),
        },
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save record.");
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (section: string, field: string, value: string | number) =>
    setAiDraft((prev) => ({ ...prev, [section]: { ...(prev?.[section] ?? {}), [field]: value } }));

  return (
    <div className="max-w-6xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-slate-200 mt-8 relative">
      <h2 className="text-2xl font-bold mb-6">{isCacheHit ? "Verify Cached Specifications" : "Verify & Save Specifications"}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Base scanned facts */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 h-fit">
          <h3 className="font-bold text-slate-700 mb-4 border-b pb-2">Base Scanned Facts</h3>
          <div className="flex flex-col gap-3 text-sm text-slate-600">
            <div className="flex justify-between items-start gap-3">
              <span className="mt-2 font-medium">Manufacturer</span>
              {!isUnknownWmi ? (
                <span className="mt-2 font-mono">{baseManufacturer}</span>
              ) : (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg w-2/3">
                  <div className="text-[10px] font-bold text-amber-700 uppercase mb-2 tracking-wide flex justify-between items-center">
                    <span>⚠️ Unknown WMI ({wmi})</span>
                    <button type="button" onClick={() => setIsAddMfgOpen(true)} className="text-orange-600 hover:underline">
                      + Add Make
                    </button>
                  </div>
                  <select value={resolvedMfg} onChange={(e) => setResolvedMfg(e.target.value)} className="w-full p-1.5 mb-2 border border-amber-300 rounded text-xs bg-white">
                    <option value="" disabled>
                      Select Make
                    </option>
                    {mfgList.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select value={resolvedCountry} onChange={(e) => setResolvedCountry(e.target.value)} className="w-full p-1.5 border border-amber-300 rounded text-xs bg-white">
                    {IMPORT_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.flag} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <span className="font-medium">Year</span>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="p-1 border border-slate-300 rounded bg-white font-mono">
                <option value="" disabled>
                  Select Year
                </option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-between">
              <span className="font-medium">WMI</span> <span className="font-mono">{wmi}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">VDS</span> <span className="font-mono">{vds}</span>
            </div>
          </div>
        </div>

        {/* Model + actions */}
        <div className="flex flex-col gap-4">
          <label className="font-bold text-slate-700">
            Vehicle Model
            <input
              type="text"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              placeholder="e.g. RAV4, Model Y"
              className="w-full p-3 border rounded mt-1 font-normal focus:outline-orange-500"
            />
          </label>

          {!isCacheHit && (
            <button
              onClick={handleGenerateAI}
              disabled={processing}
              className="w-full bg-orange-600 text-white px-4 py-3 rounded font-bold disabled:bg-slate-400 hover:bg-orange-700 transition"
            >
              {processing ? "Generating…" : aiDraft ? "Regenerate Specs (AI)" : "Generate Specs Draft (AI)"}
            </button>
          )}

          {isCacheHit && <Banner variant="success">✓ Hardware specs loaded from the DNA cache.</Banner>}
          {error && <Banner variant="error">{error}</Banner>}
        </div>
      </div>

      {/* Why the picker is empty (failed search / no matches) — visible, not silent. */}
      {imageNotice && images.length === 0 && (
        <div className="border-t pt-6 mb-8">
          <Banner variant="info">{imageNotice}</Banner>
        </div>
      )}

      {/* Image picker */}
      {images.length > 0 && (
        <div className="border-t pt-6 mb-8">
          <h3 className="font-bold text-xl mb-4 text-slate-800">Select Vehicle Image</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {images.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedImage(imgUrl)}
                className={`cursor-pointer rounded-xl overflow-hidden border-4 transition-all ${
                  selectedImage === imgUrl ? "border-orange-500 scale-105 shadow-lg" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img src={imgUrl} alt={`Option ${idx + 1}`} className="w-full h-32 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editable spec sections (adapts to whatever fields exist) */}
      {aiDraft && (
        <div className="border-t pt-6">
          <h3 className="font-bold text-xl mb-4 text-slate-800">Hardware Specifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(aiDraft).map(([section, fields]) =>
              fields && typeof fields === "object" ? (
                <div key={section} className="p-4 border rounded bg-slate-50/50">
                  <h4 className="font-bold text-slate-700 mb-3">{humanize(section)}</h4>
                  <div className="flex flex-col gap-2">
                    {Object.entries(fields).map(([field, value]) => (
                      <label key={field} className="text-xs font-bold text-slate-500">
                        {humanize(field)}
                        <input
                          type={typeof value === "number" ? "number" : "text"}
                          value={value ?? ""}
                          onChange={(e) =>
                            updateDraft(section, field, typeof value === "number" ? (e.target.value === "" ? 0 : Number(e.target.value)) : e.target.value)
                          }
                          className="w-full p-2 border rounded font-normal mt-1"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </div>

          <div className="flex justify-end gap-4 mt-8">
            <button onClick={onCancel} className="px-6 py-3 border border-slate-300 rounded font-bold text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="px-6 py-3 bg-green-600 text-white rounded font-bold hover:bg-green-700 disabled:bg-slate-400 transition shadow-md">
              {saving ? "Saving…" : "Save to Database"}
            </button>
          </div>
        </div>
      )}

      {/* Add-manufacturer modal */}
      {isAddMfgOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4 text-slate-800">Add New Manufacturer</h3>
            <input
              type="text"
              value={newMfgName}
              onChange={(e) => setNewMfgName(e.target.value)}
              placeholder="e.g. Rivian"
              className="w-full p-3 border border-slate-300 rounded mb-6 focus:outline-orange-500"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddManufacturer()}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsAddMfgOpen(false);
                  setNewMfgName("");
                }}
                className="px-4 py-2 border border-slate-300 rounded font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button onClick={handleAddManufacturer} disabled={!newMfgName.trim()} className="px-4 py-2 bg-orange-600 text-white rounded font-bold hover:bg-orange-700 disabled:bg-slate-400 transition">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
