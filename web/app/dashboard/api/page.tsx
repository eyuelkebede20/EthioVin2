"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, BarChart3, CreditCard, Copy, Check, Trash2, Plus, TriangleAlert } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { useSession } from "@/lib/auth-client";
import {
  devApi,
  ApiError,
  type ApiKeyRow,
  type CreatedKey,
  type UsageSummary,
  type CreditPackRow,
  type BillingHistory,
} from "@/lib/api";

type Tab = "keys" | "usage" | "billing";

export default function ApiDashboardPage() {
  // useSearchParams (in ApiDashboardInner) requires a Suspense boundary for the
  // static-prerender bailout.
  return (
    <Suspense fallback={<main className="p-16 text-center text-body text-fg-muted">Loading…</main>}>
      <ApiDashboardInner />
    </Suspense>
  );
}

function ApiDashboardInner() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const initialTab = (params.get("tab") as Tab) || "keys";
  const [tab, setTab] = useState<Tab>(["keys", "usage", "billing"].includes(initialTab) ? initialTab : "keys");

  useEffect(() => {
    if (!isPending && !session) router.push("/login?next=/dashboard/api");
  }, [isPending, session, router]);

  if (isPending || !session) return <main className="p-16 text-center text-body text-fg-muted">Loading…</main>;

  const tabs: { id: Tab; label: string; icon: typeof KeyRound }[] = [
    { id: "keys", label: "Keys", icon: KeyRound },
    { id: "usage", label: "Usage", icon: BarChart3 },
    { id: "billing", label: "Billing", icon: CreditCard },
  ];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <div>
          <h1 className="text-display text-fg">Developer API</h1>
          <p className="mt-1 text-body text-fg-muted">Keys, usage and credits for the EthioVin decode API.</p>
        </div>

        <div className="flex gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-body font-semibold transition ${
                tab === t.id ? "border-brand-500 text-brand-600" : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "keys" && <KeysTab />}
        {tab === "usage" && <UsageTab />}
        {tab === "billing" && <BillingTab focusTx={params.get("tx")} />}
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------
function KeysTab() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [freshKey, setFreshKey] = useState<CreatedKey | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    devApi
      .listKeys()
      .then((r) => setKeys(r.keys))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load keys."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const created = await devApi.createKey(newName.trim());
      setFreshKey(created);
      setNewName("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create key.");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this key? Any integration using it will stop working immediately.")) return;
    try {
      await devApi.revokeKey(id);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to revoke key.");
    }
  };

  return (
    <div className="space-y-6">
      {freshKey && <ShowOnceKey created={freshKey} onDone={() => setFreshKey(null)} />}

      <div className="card p-6">
        <h2 className="text-title text-fg">Create a key</h2>
        <p className="mt-1 text-body text-fg-muted">Give it a name so you can recognize it later (e.g. “production”, “staging”).</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Key name"
            maxLength={64}
            className="flex-1 rounded-lg border border-border bg-bg px-4 py-2.5 text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          />
          <button onClick={create} disabled={creating || !newName.trim()} className="btn-brand shrink-0">
            <Plus className="h-4 w-4" /> {creating ? "Creating…" : "Create key"}
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-body text-error">{error}</p>}

      <div className="card p-6">
        <h2 className="text-title text-fg">Your keys</h2>
        {loading ? (
          <p className="mt-3 text-body text-fg-muted">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="mt-3 text-body text-fg-muted">No keys yet. Create one above to start decoding.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="text-left text-caption uppercase tracking-wide text-fg-muted">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Key</th>
                  <th className="pb-2">Rate</th>
                  <th className="pb-2">Last used</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-t border-border">
                    <td className="py-2.5 font-semibold text-fg">{k.name}</td>
                    <td className="py-2.5 font-mono text-caption text-fg-muted">{k.prefix}…{k.last4}</td>
                    <td className="py-2.5 text-fg-muted">{k.rate_limit_per_min}/min</td>
                    <td className="py-2.5 text-fg-muted">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "—"}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-caption font-bold ${k.status === "active" ? "bg-success/15 text-success" : "bg-surface-2 text-fg-muted"}`}>{k.status}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      {k.status === "active" && (
                        <button onClick={() => revoke(k.id)} className="inline-flex items-center gap-1 text-caption font-semibold text-error hover:underline">
                          <Trash2 className="h-3.5 w-3.5" /> Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ShowOnceKey({ created, onDone }: { created: CreatedKey; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  };
  return (
    <div className="card border-brand-300 bg-brand-50 p-6">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lead font-bold text-fg">Copy your API key now</h3>
          <p className="mt-1 text-body text-fg-muted">
            This is the only time we’ll show it. Store it in a secret manager — if you lose it, revoke it and create a new one.
            {created.signup_grant_credits > 0 && <> You’ve been credited <strong>{created.signup_grant_credits} free credits</strong> to get started.</>}
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-bg p-3">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-caption text-fg">{created.key}</code>
            <button onClick={copy} className="btn-ghost shrink-0 px-3 py-1.5">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button onClick={onDone} className="mt-4 text-caption font-semibold text-brand-600 hover:underline">
            I’ve saved it — dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------
function UsageTab() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    devApi
      .usageSummary()
      .then(setSummary)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load usage."));
  }, []);

  if (error) return <p className="rounded-lg bg-error/10 px-3 py-2 text-body text-error">{error}</p>;
  if (!summary) return <p className="text-body text-fg-muted">Loading…</p>;

  const max = Math.max(1, ...summary.days.map((d) => d.decodes));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Balance" value={`${summary.balance}`} suffix="credits" />
        <Stat label="Decodes (30d)" value={`${summary.totals.decodes}`} />
        <Stat label="Hit ratio" value={`${summary.totals.hit_ratio}%`} />
        <Stat label="Credits spent (30d)" value={`${summary.totals.credits_spent}`} />
      </div>

      <div className="card p-6">
        <h2 className="text-title text-fg">Daily decodes</h2>
        <p className="mt-1 text-caption text-fg-muted">Since {summary.since}</p>
        {summary.days.length === 0 ? (
          <p className="mt-4 text-body text-fg-muted">No API activity yet. Make your first <code className="font-mono">POST /v1/decode</code> call to see it here.</p>
        ) : (
          <div className="mt-5 flex h-40 items-end gap-1">
            {summary.days.map((d) => (
              <div key={d.date} className="group relative flex-1" title={`${d.date}: ${d.decodes} decodes (${d.hits} hits)`}>
                <div className="w-full rounded-t bg-brand-200" style={{ height: `${(d.decodes / max) * 100}%` }}>
                  <div className="w-full rounded-t bg-brand-500" style={{ height: `${d.decodes ? (d.hits / d.decodes) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-caption text-fg-muted"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-500 align-middle" /> hits (charged) · <span className="mx-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-200 align-middle" /> parse-only (free)</p>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="card p-4">
      <p className="text-caption uppercase tracking-wide text-fg-muted">{label}</p>
      <p className="mt-1 text-title font-bold text-fg">
        {value} {suffix && <span className="text-body font-normal text-fg-muted">{suffix}</span>}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------
function BillingTab({ focusTx }: { focusTx: string | null }) {
  const [packs, setPacks] = useState<CreditPackRow[]>([]);
  const [history, setHistory] = useState<BillingHistory | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyPack, setBusyPack] = useState("");
  const [promo, setPromo] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [mockMode, setMockMode] = useState(false);

  const loadHistory = useCallback(() => {
    devApi.history().then(setHistory).catch(() => undefined);
  }, []);

  useEffect(() => {
    devApi
      .packs()
      .then((r) => {
        setPacks(r.packs);
        setTestMode(r.test_mode);
        setMockMode(r.mock_mode);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load packs."));
    loadHistory();
  }, [loadHistory]);

  // Chapa return: poll the purchase status (webhook may not have landed yet).
  useEffect(() => {
    if (!focusTx) return;
    let tries = 0;
    const tick = () => {
      devApi
        .purchase(focusTx)
        .then((p) => {
          if (p.status === "paid") {
            setNotice(`Payment confirmed — ${p.credits} credits added.`);
            loadHistory();
          } else if (p.status === "failed") {
            setError("That payment did not complete.");
          } else if (tries++ < 5) {
            setTimeout(tick, 2500);
          } else {
            setNotice("Payment is still processing. Your credits will appear once it clears.");
          }
        })
        .catch(() => undefined);
    };
    tick();
  }, [focusTx, loadHistory]);

  const buy = async (packId: string) => {
    setBusyPack(packId);
    setError("");
    try {
      const { checkout_url } = await devApi.checkout(packId);
      window.location.href = checkout_url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start checkout.");
      setBusyPack("");
    }
  };

  const redeem = async () => {
    if (!promo.trim()) return;
    setPromoBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await devApi.redeemPromo(promo.trim());
      setNotice(`Promo applied — ${r.credited} credits added. Balance: ${r.balance}.`);
      setPromo("");
      loadHistory();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not redeem that code.");
    } finally {
      setPromoBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {notice && <p className="rounded-lg bg-success/10 px-3 py-2 text-body text-success">{notice}</p>}
      {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-body text-error">{error}</p>}

      <div className="card p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-title text-fg">Balance</h2>
          <p className="text-display font-bold text-brand-600">{history?.balance ?? "—"} <span className="text-body font-normal text-fg-muted">credits</span></p>
        </div>
      </div>

      {mockMode ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-body text-warning">
          <strong>Simulated billing (mock mode).</strong> No Chapa account is connected — clicking <em>Buy</em>
          {" "}instantly credits your account so you can test the flow end to end. There is no real payment page
          and no money moves. Turn this off (unset <span className="font-mono">BILLING_MOCK_MODE</span>) in production.
        </p>
      ) : testMode ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-body text-warning">
          <strong>Sandbox / test mode.</strong> Payments use Chapa test credentials — no real money moves.
          Pay with test card <span className="font-mono">4200 0000 0000 0000</span> (CVV 123, exp 12/34) or a test
          telebirr number like <span className="font-mono">0900123456</span>.
        </p>
      ) : null}

      <div>
        <h2 className="text-title text-fg">Buy credits</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {packs.map((p) => (
            <div key={p.pack_id} className="card flex flex-col p-6">
              <p className="text-caption uppercase tracking-wide text-fg-muted">{p.pack_id}</p>
              <p className="mt-1 text-display font-bold text-fg">{p.credits.toLocaleString()}</p>
              <p className="text-body text-fg-muted">credits</p>
              <p className="mt-2 text-body text-fg-muted">{p.note}</p>
              <p className="mt-4 text-lead font-bold text-fg">{p.price_etb.toLocaleString()} ETB</p>
              <button onClick={() => buy(p.pack_id)} disabled={!!busyPack} className="btn-brand mt-4 w-full justify-center">
                {busyPack === p.pack_id ? "Starting…" : "Buy"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-title text-fg">Redeem a promo code</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            value={promo}
            onChange={(e) => setPromo(e.target.value.toUpperCase())}
            placeholder="ETHIOVIN25"
            maxLength={32}
            className="flex-1 rounded-lg border border-border bg-bg px-4 py-2.5 font-mono text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          />
          <button onClick={redeem} disabled={promoBusy || !promo.trim()} className="btn-ghost shrink-0">
            {promoBusy ? "Redeeming…" : "Redeem"}
          </button>
        </div>
      </div>

      {history && (history.purchases.length > 0 || history.promo_redemptions.length > 0 || history.grants.length > 0) && (
        <div className="card p-6">
          <h2 className="text-title text-fg">History</h2>
          <table className="mt-4 w-full text-body">
            <tbody>
              {history.purchases.map((p) => (
                <tr key={p.tx_ref} className="border-t border-border">
                  <td className="py-2 text-fg-muted">{p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}</td>
                  <td className="py-2 text-fg">Purchase · {p.pack_id}</td>
                  <td className="py-2 font-semibold text-fg">+{p.credits}</td>
                  <td className="py-2 text-right">
                    <span className={`rounded-full px-2 py-0.5 text-caption font-bold ${p.status === "paid" ? "bg-success/15 text-success" : p.status === "failed" ? "bg-error/15 text-error" : "bg-surface-2 text-fg-muted"}`}>{p.status}</span>
                  </td>
                </tr>
              ))}
              {history.promo_redemptions.map((r, i) => (
                <tr key={`promo-${i}`} className="border-t border-border">
                  <td className="py-2 text-fg-muted">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="py-2 text-fg">Promo · {r.code}</td>
                  <td className="py-2 font-semibold text-fg">+{r.credited}</td>
                  <td className="py-2 text-right"><span className="rounded-full bg-success/15 px-2 py-0.5 text-caption font-bold text-success">applied</span></td>
                </tr>
              ))}
              {history.grants.map((g, i) => (
                <tr key={`grant-${i}`} className="border-t border-border">
                  <td className="py-2 text-fg-muted">{new Date(g.created_at).toLocaleDateString()}</td>
                  <td className="py-2 text-fg">{g.kind === "admin_grant" ? "Manual grant" : "Signup grant"}</td>
                  <td className="py-2 font-semibold text-fg">+{g.credits}</td>
                  <td className="py-2 text-right"><span className="rounded-full bg-brand-100 px-2 py-0.5 text-caption font-bold text-brand-600">grant</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
