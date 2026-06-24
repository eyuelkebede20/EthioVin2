"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import AppShell from "@/components/AppShell";
import { INSURER_NAV } from "@/lib/navs";
import { insurerApi, ApiError } from "@/lib/api";

const INCIDENT_TYPES = ["accident", "theft", "recovered", "vandalism", "other"];

export default function PolicePage() {
  const [vin, setVin] = useState("");
  const [incidentType, setIncidentType] = useState("accident");
  const [severity, setSeverity] = useState(3);
  const [date, setDate] = useState("");
  const [reportRef, setReportRef] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setMsg("");
    if (vin.length !== 17) return setErr("Enter a 17-character VIN.");
    setBusy(true);
    try {
      await insurerApi.submitPolice({
        vin,
        incidentType,
        severityBand: severity,
        incidentDate: date ? new Date(date).toISOString() : undefined,
        reportRef: reportRef.trim() || undefined,
      });
      setMsg("Police report signal recorded.");
      setVin(""); setDate(""); setReportRef("");
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to submit.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "mt-1 w-full rounded-lg border border-border bg-bg p-2.5 text-body text-fg";

  return (
    <AppShell title="Insurer" nav={INSURER_NAV}>
      <h1 className="text-title text-fg">Submit a police report signal</h1>

      <div className="mt-3 flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <p className="text-body text-fg-muted">Only the incident type, severity, date and an optional reference are stored. No report contents or personal data are kept.</p>
      </div>

      <form onSubmit={submit} className="card mt-5 max-w-lg space-y-4 p-6">
        <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">
          VIN
          <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17))} className={`${inputCls} font-mono`} />
        </label>
        <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">
          Incident type
          <select value={incidentType} onChange={(e) => setIncidentType(e.target.value)} className={inputCls}>
            {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">
          Severity (1–5): <span className="text-brand-700">{severity}</span>
          <input type="range" min={1} max={5} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className="mt-2 w-full accent-brand-500" />
        </label>
        <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">
          Incident date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">
          Report reference (optional)
          <input value={reportRef} onChange={(e) => setReportRef(e.target.value)} className={inputCls} maxLength={100} />
        </label>

        {err && <p className="rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}
        {msg && <p className="rounded-lg bg-success/10 px-3 py-2 text-body text-success">{msg}</p>}
        <button disabled={busy} className="btn-brand w-full">{busy ? "Submitting…" : "Submit signal"}</button>
      </form>
    </AppShell>
  );
}
