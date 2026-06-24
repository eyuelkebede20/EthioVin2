"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import NotMember from "@/components/NotMember";
import { GARAGE_NAV } from "@/lib/navs";
import { garageApi, ApiError, JOB_STATUSES, type Job } from "@/lib/api";

export default function GarageJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [vin, setVin] = useState("");
  const [odo, setOdo] = useState("");

  const load = useCallback(() => {
    garageApi
      .listJobs(filter || undefined)
      .then(setJobs)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setErr(e instanceof ApiError ? e.message : "Failed to load jobs.");
      });
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      await garageApi.createJob({ vin: vin.trim() || undefined, odometerIn: odo ? Number(odo) : undefined });
      setVin(""); setOdo(""); setShowNew(false); load();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to create job.");
    }
  };

  if (forbidden) return <AppShell title="Garage" nav={GARAGE_NAV}><NotMember kind="garage" /></AppShell>;

  return (
    <AppShell title="Garage" nav={GARAGE_NAV}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-title text-fg">Jobs</h1>
        <button onClick={() => setShowNew((s) => !s)} className="btn-brand !px-4 !py-2">{showNew ? "Cancel" : "New job"}</button>
      </div>

      {showNew && (
        <form onSubmit={create} className="card mt-4 flex flex-wrap items-end gap-3 p-5">
          <label className="flex flex-col text-caption font-bold uppercase tracking-wide text-fg-muted">
            VIN (optional)
            <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17))} className="mt-1 rounded-lg border border-border p-2 font-mono text-body text-fg" />
          </label>
          <label className="flex flex-col text-caption font-bold uppercase tracking-wide text-fg-muted">
            Odometer (km)
            <input value={odo} onChange={(e) => setOdo(e.target.value.replace(/[^0-9]/g, ""))} className="mt-1 w-32 rounded-lg border border-border p-2 text-body text-fg" />
          </label>
          <button type="submit" className="btn-brand !py-2">Create</button>
        </form>
      )}

      {err && <p className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}

      <div className="mt-5 flex items-center gap-2">
        <span className="text-caption font-bold uppercase tracking-wide text-fg-muted">Filter</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-border bg-bg p-1.5 text-body text-fg">
          <option value="">All</option>
          {JOB_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      <div className="card mt-4 overflow-hidden">
        {jobs.length === 0 ? (
          <p className="p-8 text-center text-body text-fg-muted">No jobs yet.</p>
        ) : (
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border text-left text-caption uppercase tracking-wide text-fg-muted">
                <th className="p-3">VIN</th><th className="p-3">Status</th><th className="p-3">Total</th><th className="p-3">Opened</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-mono text-fg">{j.vin || "—"}</td>
                  <td className="p-3"><span className="rounded-full bg-surface-2 px-2 py-0.5 text-caption font-bold text-fg-muted">{j.status.replace(/_/g, " ")}</span></td>
                  <td className="p-3 font-semibold text-fg">{j.totalCost} ETB</td>
                  <td className="p-3 text-fg-muted">{new Date(j.openedAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right"><Link href={`/garage/jobs/${j.id}`} className="font-semibold text-brand-600 hover:text-brand-700">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
