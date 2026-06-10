import { useEffect, useState } from "react";
import { getUnknownWMIs, getManufacturers, updateWMI, type UnknownWMI } from "../../api/adminService";
import { ApiError } from "../../api/client";
import { IMPORT_COUNTRIES, DEFAULT_MANUFACTURERS } from "../../lib/constants";
import Banner from "../ui/Banner";

export default function WMIResolutionPanel() {
  const [unknowns, setUnknowns] = useState<UnknownWMI[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>(DEFAULT_MANUFACTURERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMfg, setNewMfg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [wmis, mfgs] = await Promise.all([getUnknownWMIs(), getManufacturers().catch(() => [] as string[])]);
        setUnknowns(wmis);
        if (mfgs.length > 0) {
          setManufacturers(Array.from(new Set([...DEFAULT_MANUFACTURERS, ...mfgs])).sort());
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Failed to load WMI data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleUpdate = async (wmi: string, manufacturer: string, country: string) => {
    setError("");
    try {
      await updateWMI({ wmi, manufacturer, country });
      setUnknowns((prev) => prev.filter((u) => u.wmi !== wmi));
      if (!manufacturers.includes(manufacturer)) setManufacturers((prev) => [...prev, manufacturer].sort());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to update WMI.");
    }
  };

  const handleAddManufacturer = () => {
    const trimmed = newMfg.trim();
    if (trimmed && !manufacturers.includes(trimmed)) setManufacturers((prev) => [...prev, trimmed].sort());
    setNewMfg("");
    setIsModalOpen(false);
  };

  if (loading) return <div className="p-4 bg-white rounded shadow text-slate-500">Loading WMI data…</div>;

  return (
    <div className="bg-white p-6 rounded shadow border border-slate-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Unknown WMIs Requiring Definition</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-slate-800 text-white px-4 py-2 rounded font-bold text-sm hover:bg-slate-700 transition">
          + Add Manufacturer
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <Banner variant="error">{error}</Banner>
        </div>
      )}

      {unknowns.length === 0 ? (
        <p className="text-green-600 font-bold">No unknown WMIs in the system.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {unknowns.map((item) => (
            <WMIUpdateForm key={item.wmi} wmi={item.wmi} mfgList={manufacturers} onSubmit={handleUpdate} />
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4 text-slate-800">Add New Manufacturer</h3>
            <input
              type="text"
              value={newMfg}
              onChange={(e) => setNewMfg(e.target.value)}
              placeholder="e.g. Rivian"
              className="w-full p-3 border border-slate-300 rounded mb-6 focus:outline-orange-500"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddManufacturer()}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setNewMfg("");
                }}
                className="px-4 py-2 border border-slate-300 rounded font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button onClick={handleAddManufacturer} disabled={!newMfg.trim()} className="px-4 py-2 bg-orange-600 text-white rounded font-bold hover:bg-orange-700 disabled:bg-slate-400 transition">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WMIUpdateForm({ wmi, mfgList, onSubmit }: { wmi: string; mfgList: string[]; onSubmit: (wmi: string, m: string, c: string) => void }) {
  const [manufacturer, setManufacturer] = useState(mfgList[0] ?? "");
  const [country, setCountry] = useState(IMPORT_COUNTRIES[0]!.name);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    await onSubmit(wmi, manufacturer, country);
    setSubmitting(false);
  };

  return (
    <div className="flex gap-4 items-center p-4 border rounded bg-slate-50">
      <div className="font-mono font-bold text-lg w-16">{wmi}</div>

      <select className="p-2 border rounded flex-1 bg-white" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)}>
        <option value="" disabled>
          Select Manufacturer
        </option>
        {mfgList.map((mfg) => (
          <option key={mfg} value={mfg}>
            {mfg}
          </option>
        ))}
      </select>

      <select className="p-2 border rounded flex-1 bg-white" value={country} onChange={(e) => setCountry(e.target.value)}>
        {IMPORT_COUNTRIES.map((c) => (
          <option key={c.code} value={c.name}>
            {c.flag} {c.name}
          </option>
        ))}
      </select>

      <button
        onClick={submit}
        className="bg-orange-600 text-white px-6 py-2 rounded font-bold hover:bg-orange-700 disabled:bg-slate-400 transition"
        disabled={!manufacturer || !country || submitting}
      >
        {submitting ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
