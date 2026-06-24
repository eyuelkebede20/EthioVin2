"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import AppShell from "@/components/AppShell";
import { GARAGE_NAV } from "@/lib/navs";
import { garageApi, ApiError, JOB_STATUSES, type Job, type JobItem, type JobStatus, type Invoice } from "@/lib/api";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);

  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<JobItem[]>([]);
  const [status, setStatus] = useState<JobStatus>("intake");
  const [odo, setOdo] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    garageApi
      .getJob(id)
      .then((j) => {
        setJob(j);
        setItems(j.items ?? []);
        setStatus(j.status);
        setOdo(j.odometerIn != null ? String(j.odometerIn) : "");
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to load job."));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const setItem = (i: number, patch: Partial<JobItem>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((prev) => [...prev, { kind: "labor", description: "", qty: 1, unitCost: 0 }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const itemsTotal = items.reduce((s, it) => s + Number(it.qty) * Number(it.unitCost), 0);

  const save = async (extra: { status?: JobStatus } = {}) => {
    setErr(""); setMsg("");
    try {
      await garageApi.updateJob(id, { items, odometerIn: odo ? Number(odo) : undefined, ...extra });
      setMsg(extra.status ? `Job set to ${extra.status}.` : "Saved.");
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to save.");
    }
  };

  const showInvoice = () => garageApi.getInvoice(id).then(setInvoice).catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to load invoice."));
  const pay = () => garageApi.payInvoice(id).then(() => { showInvoice(); load(); }).catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to mark paid."));

  return (
    <AppShell title="Garage" nav={GARAGE_NAV}>
      <Link href="/garage" className="text-body font-semibold text-brand-600 hover:text-brand-700">← Jobs</Link>

      {!job ? (
        <p className="mt-6 text-body text-fg-muted">{err || "Loading…"}</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-title text-fg">Job {job.vin ? <span className="font-mono">{job.vin}</span> : "(no VIN)"}</h1>
              <p className="text-body text-fg-muted">Opened {new Date(job.openedAt).toLocaleString()}{job.closedAt ? ` · Closed ${new Date(job.closedAt).toLocaleDateString()}` : ""}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-caption font-bold ${job.paid ? "bg-success/15 text-success" : "bg-surface-2 text-fg-muted"}`}>{job.paid ? "Paid" : job.status.replace(/_/g, " ")}</span>
          </div>

          {err && <p className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}
          {msg && <p className="mt-4 rounded-lg bg-success/10 px-3 py-2 text-body text-success">{msg}</p>}

          {/* Line items */}
          <div className="card mt-5 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lead font-bold text-fg">Line items</h2>
              <button onClick={addItem} className="btn-ghost !px-3 !py-1.5 text-caption"><Plus className="h-4 w-4" /> Add</button>
            </div>
            <div className="mt-3 space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select value={it.kind} onChange={(e) => setItem(i, { kind: e.target.value as "labor" | "part" })} className="rounded-lg border border-border p-2 text-body">
                    <option value="labor">labor</option>
                    <option value="part">part</option>
                  </select>
                  <input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="Description" className="flex-1 rounded-lg border border-border p-2 text-body" />
                  <input value={String(it.qty)} onChange={(e) => setItem(i, { qty: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} className="w-16 rounded-lg border border-border p-2 text-body" />
                  <input value={String(it.unitCost)} onChange={(e) => setItem(i, { unitCost: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} className="w-24 rounded-lg border border-border p-2 text-body" placeholder="Unit" />
                  <button onClick={() => removeItem(i)} className="text-error hover:opacity-70"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {items.length === 0 && <p className="text-body text-fg-muted">No items.</p>}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-body font-bold text-fg">Total: {itemsTotal.toFixed(2)} ETB</span>
              <button onClick={() => save()} className="btn-brand !py-2">Save items</button>
            </div>
          </div>

          {/* Status + odometer */}
          <div className="card mt-5 flex flex-wrap items-end gap-3 p-5">
            <label className="flex flex-col text-caption font-bold uppercase tracking-wide text-fg-muted">
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as JobStatus)} className="mt-1 rounded-lg border border-border p-2 text-body">
                {JOB_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-caption font-bold uppercase tracking-wide text-fg-muted">
              Odometer (km)
              <input value={odo} onChange={(e) => setOdo(e.target.value.replace(/[^0-9]/g, ""))} className="mt-1 w-32 rounded-lg border border-border p-2 text-body" />
            </label>
            <button onClick={() => save({ status })} className="btn-brand !py-2">Update job</button>
            <p className="text-caption text-fg-muted">Setting status to done/delivered closes the job and records it to the vehicle&apos;s history.</p>
          </div>

          {/* Invoice */}
          <div className="card mt-5 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lead font-bold text-fg">Invoice</h2>
              <button onClick={showInvoice} className="btn-ghost !px-3 !py-1.5 text-caption">Generate</button>
            </div>
            {invoice && (
              <div className="mt-3">
                <p className="font-mono text-body text-fg-muted">{invoice.invoiceNumber}</p>
                <table className="mt-2 w-full text-body">
                  <tbody>
                    {invoice.lines.map((l, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-1.5 text-fg">{l.description}</td>
                        <td className="py-1.5 text-right text-fg-muted">{String(l.qty)} × {String(l.unitCost)}</td>
                        <td className="py-1.5 text-right font-semibold text-fg">{l.lineTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lead font-bold text-fg">Total {invoice.total.toFixed(2)} ETB</span>
                  {invoice.paid ? <span className="rounded-full bg-success/15 px-3 py-1 text-caption font-bold text-success">Paid</span> : <button onClick={pay} className="btn-brand !py-2">Mark paid</button>}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
