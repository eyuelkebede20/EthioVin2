"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import NotMember from "@/components/NotMember";
import { GARAGE_NAV } from "@/lib/navs";
import { garageApi, ApiError, type Customer } from "@/lib/api";

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const load = useCallback(() => {
    garageApi.listCustomers().then(setRows).catch((e) => {
      if (e instanceof ApiError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiError ? e.message : "Failed to load.");
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErr("");
    try {
      await garageApi.createCustomer({ name: name.trim(), phone: phone.trim() || undefined });
      setName(""); setPhone(""); load();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to add customer.");
    }
  };

  if (forbidden) return <AppShell title="Garage" nav={GARAGE_NAV}><NotMember kind="garage" /></AppShell>;

  return (
    <AppShell title="Garage" nav={GARAGE_NAV}>
      <h1 className="text-title text-fg">Customers</h1>
      <form onSubmit={create} className="card mt-4 flex flex-wrap items-end gap-3 p-5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="flex-1 rounded-lg border border-border p-2 text-body" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="rounded-lg border border-border p-2 text-body" />
        <button className="btn-brand !py-2">Add</button>
      </form>
      {err && <p className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}
      <div className="card mt-4 overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-body text-fg-muted">No customers yet.</p>
        ) : (
          <table className="w-full text-body">
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-semibold text-fg">{c.name}</td>
                  <td className="p-3 text-fg-muted">{c.phone || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
