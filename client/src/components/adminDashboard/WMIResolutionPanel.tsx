import { useEffect, useState } from "react";

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

type WMI = { wmi: string; manufacturer: string; country: string };

export default function WMIResolutionPanel() {
  const [unknowns, setUnknowns] = useState<WMI[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>(INITIAL_MANUFACTURERS);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMfg, setNewMfg] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const wmiRes = await fetch(`${BACKEND_URL}/api/v1/admin/wmi/unknown`, { credentials: "include" });
      if (wmiRes.ok) setUnknowns(await wmiRes.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (wmi: string, manufacturer: string, country: string) => {
    // Fixed hardcoded localhost
    const res = await fetch(`${BACKEND_URL}/api/v1/admin/wmi/update`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ wmi, manufacturer, country }),
    });

    if (res.ok) {
      setUnknowns(unknowns.filter((u) => u.wmi !== wmi));
      if (!manufacturers.includes(manufacturer)) {
        setManufacturers([...manufacturers, manufacturer]);
      }
    } else {
      alert("Failed to update WMI");
    }
  };

  const handleAddManufacturer = () => {
    const trimmed = newMfg.trim();
    if (trimmed && !manufacturers.includes(trimmed)) {
      setManufacturers((prev) => [...prev, trimmed].sort());
    }
    setNewMfg("");
    setIsModalOpen(false);
  };

  if (loading) return <div className="p-4 bg-white rounded shadow text-slate-500">Loading WMI data...</div>;

  return (
    <div className="bg-white p-6 rounded shadow border border-slate-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Unknown WMIs Requiring Definition</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-slate-800 text-white px-4 py-2 rounded font-bold text-sm hover:bg-slate-700 transition">
          + Add Manufacturer
        </button>
      </div>

      {unknowns.length === 0 ? (
        <p className="text-green-600 font-bold">No unknown WMIs in the system.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {unknowns.map((item) => (
            <WMIUpdateForm key={item.wmi} wmi={item.wmi} mfgList={manufacturers} onSubmit={handleUpdate} />
          ))}
        </div>
      )}

      {/* Add Manufacturer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4 text-slate-800">Add New Manufacturer</h3>
            <input
              type="text"
              value={newMfg}
              onChange={(e) => setNewMfg(e.target.value)}
              placeholder="e.g. Rivian"
              className="w-full p-3 border border-slate-300 rounded mb-6 focus:outline-blue-500 font-normal"
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
              <button onClick={handleAddManufacturer} disabled={!newMfg.trim()} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 disabled:bg-slate-400 transition">
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
  const [manufacturer, setManufacturer] = useState(mfgList[0] || "");
  const [country, setCountry] = useState(IMPORT_COUNTRIES[0].name);

  return (
    <div className="flex gap-4 items-center p-4 border rounded bg-slate-50">
      <div className="font-mono font-bold text-lg w-16">{wmi}</div>

      <select className="p-2 border rounded flex-1 bg-white cursor-pointer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)}>
        <option value="" disabled>
          Select Manufacturer
        </option>
        {mfgList.map((mfg) => (
          <option key={mfg} value={mfg}>
            {mfg}
          </option>
        ))}
      </select>

      <select className="p-2 border rounded flex-1 bg-white cursor-pointer text-base" value={country} onChange={(e) => setCountry(e.target.value)}>
        {IMPORT_COUNTRIES.map((c) => (
          <option key={c.code} value={c.name}>
            {c.flag} {c.name}
          </option>
        ))}
      </select>

      <button
        onClick={() => onSubmit(wmi, manufacturer, country)}
        className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 disabled:bg-slate-400 transition"
        disabled={!manufacturer || !country}
      >
        Save
      </button>
    </div>
  );
}
