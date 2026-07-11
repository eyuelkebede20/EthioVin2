"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Search, Gift, Ticket, Ban, Check } from "lucide-react";
import AppShell from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/navs";
import { adminApi, ApiError, type CreditLookup, type PromoRow } from "@/lib/api";

export default function AdminCreditsPage() {
  return (
    <AppShell title="Admin" nav={ADMIN_NAV} requireRole="super_admin">
      <h1 className="text-title text-fg">Credits &amp; promos</h1>
      <p className="mt-1 text-body text-fg-muted">Grant credits to any account — no payment required — and manage promo codes.</p>
      <div className="mt-6 space-y-8">
        <GrantCredits />
        <Promos />
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Grant credits to a specific user
// ---------------------------------------------------------------------------
function GrantCredits() {
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<CreditLookup | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const lookup = async () => {
    if (!email.trim()) return;
    setBusy(true); setErr(""); setOk(""); setFound(null);
    try {
      setFound(await adminApi.lookupCredits({ email: email.trim() }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Lookup failed.");
    } finally {
      setBusy(false);
    }
  };

  const grant = async () => {
    const amt = Number(amount);
    if (!found || !Number.isFinite(amt) || amt <= 0) return;
    setBusy(true); setErr(""); setOk("");
    try {
      const r = await adminApi.grantCredits({ ownerId: found.user.id, amount: Math.floor(amt), note: note.trim() || undefined });
      setOk(`Granted ${Math.floor(amt)} credits to ${found.user.email}. New balance: ${r.balance}.`);
      setAmount(""); setNote("");
      // refresh the panel with the new balance + ledger entry
      setFound(await adminApi.lookupCredits({ ownerId: found.user.id }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Grant failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600"><Gift className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lead font-bold text-fg">Grant credits to a user</h2>
          <p className="mt-1 text-body text-fg-muted">Look a user up by email, then add credits directly to their balance (e.g. an enterprise bank-transfer deal or goodwill). Every grant is audit-logged.</p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder="user@example.com"
              className="flex-1 rounded-lg border border-border bg-bg px-4 py-2.5 text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            />
            <button onClick={lookup} disabled={busy || !email.trim()} className="btn-ghost shrink-0">
              <Search className="h-4 w-4" /> Look up
            </button>
          </div>

          {err && <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}
          {ok && <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-body text-success">{ok}</p>}

          {found && (
            <div className="mt-5 rounded-xl border border-border bg-surface-2/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-body font-bold text-fg">{found.user.name || found.user.email}</p>
                  <p className="text-caption text-fg-muted">{found.user.email} · <span className="font-mono">{found.user.id}</span></p>
                </div>
                <p className="text-title font-bold text-brand-600 flex items-center gap-1"><Coins className="h-5 w-5" /> {found.balance} <span className="text-body font-normal text-fg-muted">credits</span></p>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="Amount"
                  className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:w-40"
                />
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (optional) — e.g. bank transfer #123"
                  maxLength={200}
                  className="flex-1 rounded-lg border border-border bg-bg px-4 py-2.5 text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                />
                <button onClick={grant} disabled={busy || !amount} className="btn-brand shrink-0">Grant</button>
              </div>

              {found.recent.length > 0 && (
                <div className="mt-5">
                  <p className="text-caption font-bold uppercase tracking-wide text-fg-muted">Recent activity</p>
                  <table className="mt-2 w-full text-caption">
                    <tbody>
                      {found.recent.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="py-1.5 text-fg-muted">{new Date(r.created_at).toLocaleDateString()}</td>
                          <td className="py-1.5 text-fg-muted">{r.reason}</td>
                          <td className={`py-1.5 font-semibold ${r.delta >= 0 ? "text-success" : "text-error"}`}>{r.delta >= 0 ? "+" : ""}{r.delta}</td>
                          <td className="py-1.5 text-right font-mono text-fg-muted">{r.balance_after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Promo codes
// ---------------------------------------------------------------------------
function Promos() {
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    adminApi.listPromos().then((r) => setPromos(r.promos)).catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to load promos."));
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    const c = Number(credits);
    if (!Number.isFinite(c) || c <= 0) return;
    setBusy(true); setErr("");
    try {
      await adminApi.createPromo({
        code: code.trim() || undefined,
        credits: Math.floor(c),
        maxRedemptions: maxRedemptions ? Math.floor(Number(maxRedemptions)) : undefined,
      });
      setCode(""); setCredits(""); setMaxRedemptions("");
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to create promo.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (p: PromoRow) => {
    try {
      await adminApi.updatePromo(p.id, p.status === "active" ? "disabled" : "active");
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to update promo.");
    }
  };

  return (
    <section className="card p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600"><Ticket className="h-6 w-6" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lead font-bold text-fg">Promo codes</h2>
          <p className="mt-1 text-body text-fg-muted">Create a code users redeem for free credits. Leave the code blank to auto-generate an unambiguous one.</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE (optional)" maxLength={32} className="rounded-lg border border-border bg-bg px-4 py-2.5 font-mono text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand-400" />
            <input value={credits} onChange={(e) => setCredits(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Credits" className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:w-28" />
            <input value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Max uses" className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:w-28" />
            <button onClick={create} disabled={busy || !credits} className="btn-brand shrink-0">Create</button>
          </div>

          {err && <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}

          {promos.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-body">
                <thead>
                  <tr className="text-left text-caption uppercase tracking-wide text-fg-muted">
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Credits</th>
                    <th className="pb-2">Redeemed</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="py-2.5 font-mono font-semibold text-fg">{p.code}</td>
                      <td className="py-2.5 text-fg-muted">{p.credits}</td>
                      <td className="py-2.5 text-fg-muted">{p.redeemedCount}{p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""}</td>
                      <td className="py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-caption font-bold ${p.status === "active" ? "bg-success/15 text-success" : "bg-surface-2 text-fg-muted"}`}>{p.status}</span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => toggle(p)} className="inline-flex items-center gap-1 text-caption font-semibold text-brand-600 hover:underline">
                          {p.status === "active" ? <><Ban className="h-3.5 w-3.5" /> Disable</> : <><Check className="h-3.5 w-3.5" /> Enable</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
