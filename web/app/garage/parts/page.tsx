"use client";

import { useCallback, useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import AppShell from "@/components/AppShell";
import NotMember from "@/components/NotMember";
import { GARAGE_NAV } from "@/lib/navs";
import { garageApi, ApiError, type Part } from "@/lib/api";

export default function PartsPage() {
  const [rows, setRows] = useState<Part[]>([]);
  const [lowOnly, setLowOnly] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [reorder, setReorder] = useState("");
  const [cost, setCost] = useState("");

  const load = useCallback(() => {
    garageApi.listParts(lowOnly).then(setRows).catch((e) => {
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiError ? e.message : "Failed to load.");
    });
  }, [lowOnly]);
  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErr("");
    try {
      await garageApi.createPart({ name: name.trim(), qtyOnHand: Number(qty) || 0, reorderLevel: Number(reorder) || 0, unitCost: Number(cost) || 0 });
      setName(""); setQty(""); setReorder(""); setCost(""); load();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to add part.");
    }
  };

  const adjust = async (id: string, delta: number) => {
    try { await garageApi.updatePart(id, { qtyDelta: delta }); load(); } catch (e) { setErr(e instanceof ApiError ? e.message : "Failed."); }
  };

  if (forbidden) return <AppShell title="Garage" nav={GARAGE_NAV}><NotMember kind="garage" /></AppShell>;

  return (
    <AppShell title="Garage" nav={GARAGE_NAV}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title text-fg">Parts</h1>
        <label className="flex items-center gap-2 text-body text-fg-muted">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock only
        </label>
      </div>
      <form onSubmit={create} className="card mt-4 flex flex-wrap items-end gap-3 p-5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Part name" className="flex-1 rounded-lg border border-border p-2 text-body" />
        <input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Qty" className="w-20 rounded-lg border border-border p-2 text-body" />
        <input value={reorder} onChange={(e) => setReorder(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Reorder" className="w-24 rounded-lg border border-border p-2 text-body" />
        <input value={cost} onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Unit cost" className="w-28 rounded-lg border border-border p-2 text-body" />
        <button className="btn-brand !py-2">Add</button>
      </form>
      {err && <p className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}
      <div className="card mt-4 overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-body text-fg-muted">No parts.</p>
        ) : (
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border text-left text-caption uppercase tracking-wide text-fg-muted">
                <th className="p-3">Part</th><th className="p-3">On hand</th><th className="p-3">Reorder</th><th className="p-3">Unit</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const low = p.qtyOnHand <= p.reorderLevel;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="p-3 font-semibold text-fg">{p.name}</td>
                    <td className="p-3"><span className={low ? "font-bold text-error" : "text-fg"}>{p.qtyOnHand}</span></td>
                    <td className="p-3 text-fg-muted">{p.reorderLevel}</td>
                    <td className="p-3 text-fg-muted">{p.unitCost}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => adjust(p.id, -1)} className="rounded-lg border border-border p-1.5 hover:bg-surface-2" aria-label="decrease"><Minus className="h-4 w-4" /></button>
                        <button onClick={() => adjust(p.id, 1)} className="rounded-lg border border-border p-1.5 hover:bg-surface-2" aria-label="increase"><Plus className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
