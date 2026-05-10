import React, { useState } from "react";

import { scanVin, type ScanResponse } from "../api/vinService";

const RegionToggle = ({ region, onRegionChange }: { region: string; onRegionChange: (r: string) => void }) => {
  return (
    <div className="inline-flex bg-slate-200 p-1 rounded-xl mb-6">
      <button onClick={() => onRegionChange("asean")} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${region === "asean" ? "bg-white shadow text-blue-600" : "text-slate-600"}`}>
        ASEAN / GLOBAL (17 Digits)
      </button>
      <button onClick={() => onRegionChange("japan")} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${region === "japan" ? "bg-white shadow text-blue-600" : "text-slate-600"}`}>
        JAPAN (Chassis No.)
      </button>
    </div>
  );
};

const SearchBox = ({ region, vin, setVin, error, setError, onDecode, loading }: any) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase();

    if (region === "asean") {
      value = value.replace(/[IOQ]/g, "").slice(0, 17);
      if (value.length > 0 && !/^[A-Z0-9]*$/.test(value)) return;
    } else {
      value = value.slice(0, 15);
      if (value.length > 0 && !/^[A-Z0-9-]*$/.test(value)) return;
    }

    setVin(value);
    setError("");
  };

  return (
    // Added form tag to allow "Enter" key submissions
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onDecode();
      }}
      className="relative group text-left"
    >
      <input
        type="text"
        value={vin}
        onChange={handleInputChange}
        disabled={loading}
        placeholder={region === "asean" ? "Enter 17-digit VIN..." : "e.g. GDH201-1234567"}
        className={`w-full p-5 text-lg border-2 rounded-2xl outline-none transition-all ${error ? "border-red-400" : "border-slate-200 focus:border-blue-500"} ${loading ? "opacity-50" : ""}`}
      />
      <button type="submit" disabled={loading} className="absolute right-3 top-3 bottom-3 bg-blue-600 text-white px-8 rounded-xl font-bold hover:bg-blue-700 transition disabled:bg-blue-400">
        {loading ? "DECODING..." : "DECODE"}
      </button>
      {error && <p className="text-red-500 text-sm mt-3 font-medium">{error}</p>}
    </form>
  );
};

export default function Scanner({ onScanComplete }: { onScanComplete: (res: ScanResponse) => void }) {
  const [region, setRegion] = useState("asean");
  const [vin, setVin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDecode = async () => {
    if (region === "japan") {
      setError("JDM decoding is not yet implemented on the backend.");
      return;
    }

    if (vin.length !== 17) {
      setError("ISO VIN must be exactly 17 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 2. Use the imported function directly
      const result = await scanVin(vin);

      // 3. Inject the VIN back into the payload so the ledger can save it
      result.vin = vin;

      onScanComplete(result);
    } catch (err: any) {
      // 4. Standard fetch error handling
      setError(err.message || "Network error. Check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 bg-white rounded-2xl shadow-sm border border-slate-100 text-center">
      <RegionToggle region={region} onRegionChange={setRegion} />
      <SearchBox region={region} vin={vin} setVin={setVin} error={error} setError={setError} onDecode={handleDecode} loading={loading} />
    </div>
  );
}
