"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import NotMember from "@/components/NotMember";
import { GARAGE_NAV } from "@/lib/navs";
import { garageApi, ApiError, type Appointment } from "@/lib/api";

export default function AppointmentsPage() {
  const [rows, setRows] = useState<Appointment[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [err, setErr] = useState("");
  const [vin, setVin] = useState("");
  const [when, setWhen] = useState("");

  const load = useCallback(() => {
    garageApi.listAppointments().then(setRows).catch((e) => {
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiError ? e.message : "Failed to load.");
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!when) return setErr("Pick a date/time.");
    setErr("");
    try {
      await garageApi.createAppointment({ vin: vin.trim() || undefined, scheduledAt: new Date(when).toISOString() });
      setVin(""); setWhen(""); load();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to book.");
    }
  };

  if (forbidden) return <AppShell title="Garage" nav={GARAGE_NAV}><NotMember kind="garage" /></AppShell>;

  return (
    <AppShell title="Garage" nav={GARAGE_NAV}>
      <h1 className="text-title text-fg">Appointments</h1>
      <form onSubmit={create} className="card mt-4 flex flex-wrap items-end gap-3 p-5">
        <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17))} placeholder="VIN (optional)" className="rounded-lg border border-border p-2 font-mono text-body" />
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-lg border border-border p-2 text-body" />
        <button className="btn-brand !py-2">Book</button>
      </form>
      {err && <p className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}
      <div className="card mt-4 overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-body text-fg-muted">No appointments.</p>
        ) : (
          <table className="w-full text-body">
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-fg">{new Date(a.scheduledAt).toLocaleString()}</td>
                  <td className="p-3 font-mono text-fg-muted">{a.vin || "—"}</td>
                  <td className="p-3"><span className="rounded-full bg-surface-2 px-2 py-0.5 text-caption font-bold text-fg-muted">{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
