"use client";

import { useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { INSURER_NAV } from "@/lib/navs";
import { insurerApi, ApiError, type InsurerVehicleView } from "@/lib/api";

const GRADE_STYLE: Record<string, string> = {
  A: "bg-success/15 text-success",
  B: "bg-success/15 text-success",
  C: "bg-warning/15 text-warning",
  D: "bg-brand-100 text-brand-700",
  F: "bg-error/15 text-error",
};

export default function InsurerLookupPage() {
  const [vin, setVin] = useState("");
  const [view, setView] = useState<InsurerVehicleView | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (vin.length !== 17) return setErr("Enter a 17-character VIN.");
    setLoading(true); setErr(""); setView(null);
    try {
      setView(await insurerApi.lookupVehicle(vin));
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Insurer" nav={INSURER_NAV}>
      <h1 className="text-title text-fg">Vehicle lookup</h1>
      <p className="mt-1 text-body text-fg-muted">A privacy-safe health grade and event summary. No personal data is shared — only the signals you need to assess risk.</p>

      <form onSubmit={lookup} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fg-muted" />
          <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17))} placeholder="17-character VIN" className="w-full rounded-lg border border-border bg-bg py-3 pl-12 pr-4 font-mono text-body text-fg shadow-sm focus:border-brand-400" />
        </div>
        <button disabled={loading} className="btn-brand">{loading ? "Looking up…" : "Look up"}</button>
      </form>

      {err && <p className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}

      {view && (
        <div className="mt-6 space-y-5">
          <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <span className="text-caption font-bold uppercase tracking-wide text-fg-muted">Vehicle</span>
              <h2 className="text-lead font-bold text-fg">{[view.vehicle.year, view.vehicle.manufacturer, view.vehicle.model].filter((x) => x && x !== "Unknown").join(" ") || "Unknown vehicle"}</h2>
              <p className="font-mono text-caption text-fg-muted">{view.vehicle.vin}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-caption uppercase tracking-wide text-fg-muted">Health</p>
                <p className="text-body font-semibold text-fg">{view.healthGrade.score}/100</p>
              </div>
              <span className={`flex h-16 w-16 items-center justify-center rounded-xl text-display font-black ${GRADE_STYLE[view.healthGrade.grade] ?? "bg-surface-2 text-fg"}`}>{view.healthGrade.grade}</span>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="flex items-center gap-2 text-lead font-bold text-fg"><ShieldCheck className="h-5 w-5 text-brand-600" /> Factors</h3>
            <ul className="mt-3 space-y-1 text-body text-fg">{view.healthGrade.factors.map((f, i) => <li key={i}>• {f}</li>)}</ul>
          </div>

          <div className="card p-6">
            <h3 className="text-lead font-bold text-fg">Event summary</h3>
            {view.eventSummary.length === 0 ? (
              <p className="mt-2 text-body text-fg-muted">No recorded events.</p>
            ) : (
              <table className="mt-3 w-full text-body">
                <tbody>
                  {view.eventSummary.map((e) => (
                    <tr key={e.type} className="border-b border-border last:border-0">
                      <td className="py-2 text-fg">{e.type.replace(/_/g, " ")}</td>
                      <td className="py-2 text-right font-semibold text-fg">{e.count}</td>
                      <td className="py-2 text-right text-fg-muted">{e.lastAt ? new Date(e.lastAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
