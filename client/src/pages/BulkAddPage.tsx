import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { bulkLog, type BulkLogResponse, type BulkStatus } from "../api/vinService";
import { ApiError } from "../api/client";
import Banner from "../components/ui/Banner";

const MAX_VINS = 100;

// Split pasted text into VINs: one per line, or comma/space/tab separated. Keep
// I/O/Q (ASEAN VINs), uppercase, strip other non-alphanumerics, dedupe, cap at MAX.
function parseVinList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of text.split(/[\s,;]+/)) {
    const vin = token.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (vin.length < 11 || vin.length > 17) continue; // ignore obvious noise
    if (!seen.has(vin)) {
      seen.add(vin);
      out.push(vin);
    }
  }
  return out.slice(0, MAX_VINS);
}

const STATUS_STYLE: Record<BulkStatus, { label: string; className: string }> = {
  added: { label: "Added", className: "bg-green-100 text-green-800" },
  exists: { label: "Already recorded", className: "bg-slate-100 text-slate-600" },
  needs_verification: { label: "Needs verification", className: "bg-amber-100 text-amber-800" },
  invalid: { label: "Invalid VIN", className: "bg-red-100 text-red-700" },
  error: { label: "Error", className: "bg-red-100 text-red-700" },
};

export default function BulkAddPage() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkLogResponse | null>(null);

  const vins = useMemo(() => parseVinList(text), [text]);
  const overflow = useMemo(() => parseVinList(text).length >= MAX_VINS && text.split(/[\s,;]+/).filter(Boolean).length > MAX_VINS, [text]);

  const run = async () => {
    if (!vins.length) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await bulkLog(vins));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Bulk add failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <h1 className="text-2xl font-bold text-slate-800">Bulk add vehicles</h1>
      <p className="mt-2 text-slate-600">
        Paste many VINs (one per line, or comma-separated). Any whose model is <strong>already known</strong> is recorded
        instantly — no AI, no cost. VINs of models we don&apos;t know yet are flagged so you can verify them one by one.
      </p>

      <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <label className="block font-semibold text-slate-700 mb-2">
          VINs <span className="font-normal text-slate-400">({vins.length}/{MAX_VINS})</span>
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"LCCE4CB7S45208105\nMBHZF6C17PG327826\nLZZ5ELND3SD379138"}
          className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm focus:outline-orange-500"
        />
        {overflow && <Banner variant="info">Only the first {MAX_VINS} VINs will be processed. Run again for the rest.</Banner>}
        {error && <Banner variant="error">{error}</Banner>}
        <button
          onClick={run}
          disabled={busy || vins.length === 0}
          className="mt-4 w-full sm:w-auto bg-orange-600 text-white px-6 py-3 rounded-lg font-bold disabled:bg-slate-300 hover:bg-orange-700 transition"
        >
          {busy ? "Processing…" : `Add ${vins.length || ""} vehicle${vins.length === 1 ? "" : "s"}`}
        </button>
      </div>

      {result && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-wrap gap-3 mb-4">
            <SummaryChip label="Added" value={result.summary.added} className="bg-green-100 text-green-800" />
            <SummaryChip label="Already recorded" value={result.summary.exists} className="bg-slate-100 text-slate-600" />
            <SummaryChip label="Needs verification" value={result.summary.needs_verification} className="bg-amber-100 text-amber-800" />
            {result.summary.invalid > 0 && <SummaryChip label="Invalid" value={result.summary.invalid} className="bg-red-100 text-red-700" />}
            {result.summary.error > 0 && <SummaryChip label="Errors" value={result.summary.error} className="bg-red-100 text-red-700" />}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4 font-semibold">VIN</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 pr-4 font-semibold">Vehicle</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => {
                  const style = STATUS_STYLE[r.status];
                  return (
                    <tr key={r.vin} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-mono text-slate-700">{r.vin}</td>
                      <td className="py-2 pr-4">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className}`}>{style.label}</span>
                        {r.message && <span className="ml-2 text-xs text-slate-400">{r.message}</span>}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">
                        {r.make || r.model ? [r.make, r.model].filter(Boolean).join(" ") : "—"}
                        {r.status === "needs_verification" && (
                          <Link to="/scan" className="ml-2 text-orange-600 hover:underline text-xs">
                            verify →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryChip({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${className}`}>
      <span className="text-lg font-bold">{value}</span> {label}
    </span>
  );
}
