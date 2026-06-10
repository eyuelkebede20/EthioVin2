import React, { useState } from "react";
import { scanVin, type ScanResponse } from "../api/vinService";

const RegionToggle = ({ region, onRegionChange }: { region: string; onRegionChange: (r: string) => void }) => {
  return (
    <div className="inline-flex bg-slate-200 p-1 rounded-xl mb-6">
      <button onClick={() => onRegionChange("asean")} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${region === "asean" ? "bg-white shadow text-orange-600" : "text-slate-600"}`}>
        ASEAN / GLOBAL (17 Digits)
      </button>
      <button onClick={() => onRegionChange("japan")} className={`px-6 py-2 rounded-lg text-sm font-bold transition ${region === "japan" ? "bg-white shadow text-orange-600" : "text-slate-600"}`}>
        JAPAN (Chassis No.)
      </button>
    </div>
  );
};

interface SearchBoxProps {
  region: string;
  vin: string;
  setVin: (v: string) => void;
  error: string;
  setError: (v: string) => void;
  onDecode: () => void;
  loading: boolean;
}

const SearchBox = ({ region, vin, setVin, error, setError, onDecode, loading }: SearchBoxProps) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase();

    if (region === "asean") {
      // Keep I/O/Q (these VINs legitimately contain O); stripping it would shift
      // the year position. Just uppercase, drop separators, cap at 17.
      value = value.replace(/[^A-Z0-9]/g, "").slice(0, 17);
    } else {
      value = value.slice(0, 15);
      if (value.length > 0 && !/^[A-Z0-9-]*$/.test(value)) return;
    }

    setVin(value);
    setError("");
  };

  return (
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
        className={`w-full p-5 text-lg border-2 rounded-2xl outline-none transition-all ${error ? "border-red-400" : "border-slate-200 focus:border-orange-500"} ${loading ? "opacity-50" : ""}`}
      />
      <button
        type="submit"
        disabled={loading}
        className="absolute right-3 top-3 bottom-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-8 rounded-xl font-bold hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/40 transition disabled:opacity-60"
      >
        {loading ? "DECODING..." : "DECODE"}
      </button>
      {error && <p className="text-red-500 text-sm mt-3 font-medium">{error}</p>}
    </form>
  );
};

export default function Scanner({ onScanComplete }: { onScanComplete: (res: ScanResponse & { vin: string }) => void }) {
  const [region, setRegion] = useState("asean");
  const [vin, setVin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDecode = async () => {
    if (region === "japan") {
      setError("JDM decoding is not yet implemented on the backend.");
      return;
    }

    const cleanVin = vin
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (cleanVin.length !== 17) {
      setError("VIN must be exactly 17 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await scanVin(cleanVin);

      // Merge the sanitized VIN into the result safely to avoid mutating the strict response interface
      const payload = { ...result, vin: cleanVin };

      onScanComplete(payload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error. Check backend connection.");
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
