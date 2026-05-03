import { useEffect, useState } from "react";

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

type WMI = { wmi: string; manufacturer: string; country: string };

export default function WMIResolutionPanel() {
  const [unknowns, setUnknowns] = useState<WMI[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [wmiRes, mfgRes] = await Promise.all([
        fetch("http://localhost:3000/api/v1/admin/wmi/unknown", { credentials: "include" }),
        fetch("http://localhost:3000/api/v1/admin/wmi/manufacturers", { credentials: "include" }),
      ]);

      if (wmiRes.ok) setUnknowns(await wmiRes.json());
      if (mfgRes.ok) setManufacturers(await mfgRes.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (wmi: string, manufacturer: string, country: string) => {
    const res = await fetch("http://localhost:3000/api/v1/admin/wmi/update", {
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

  if (loading) return <div className="p-4 bg-white rounded shadow text-slate-500">Loading WMI data...</div>;

  return (
    <div className="bg-white p-6 rounded shadow border border-slate-200">
      <h2 className="text-xl font-bold mb-4">Unknown WMIs Requiring Definition</h2>

      {unknowns.length === 0 ? (
        <p className="text-green-600 font-bold">No unknown WMIs in the system.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {unknowns.map((item) => (
            <WMIUpdateForm key={item.wmi} wmi={item.wmi} mfgList={manufacturers} onSubmit={handleUpdate} />
          ))}
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

      <button onClick={() => onSubmit(wmi, manufacturer, country)} className="bg-blue-600 text-white px-6 py-2 rounded font-bold disabled:bg-slate-400" disabled={!manufacturer || !country}>
        Save
      </button>
    </div>
  );
}
