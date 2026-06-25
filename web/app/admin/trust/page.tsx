"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, Flag, Users } from "lucide-react";
import AppShell from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/navs";
import { adminApi, ApiError, type Contributor, type DataFlag } from "@/lib/api";

// Trust score → color band. Accounts start at 100% and drop as fraudulent
// entries resolve against them, so low = suspect.
function scoreTone(score: number) {
  if (score >= 90) return { text: "text-success", bar: "bg-success" };
  if (score >= 70) return { text: "text-warning", bar: "bg-warning" };
  return { text: "text-error", bar: "bg-error" };
}

const flagTone: Record<string, string> = {
  open: "bg-error/15 text-error",
  corroborating: "bg-warning/15 text-warning",
  resolved: "bg-success/15 text-success",
};

export default function AdminTrustPage() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [flags, setFlags] = useState<DataFlag[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.listContributors(), adminApi.listFlags()])
      .then(([c, f]) => { setContributors(c); setFlags(f); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to load trust data."))
      .finally(() => setLoading(false));
  }, []);

  const openFlags = flags.filter((f) => f.status !== "resolved");

  return (
    <AppShell title="Admin" nav={ADMIN_NAV} requireRole="super_admin">
      <h1 className="text-title text-fg">Trust &amp; Fraud</h1>
      <p className="mt-1 text-body text-fg-muted">
        Contributors start at 100% and lose score only when a flagged field <em>resolves</em> against them.
        A field conflict opens a flag; corroborating entries decide the truth.
      </p>
      {err && <p className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}
      {loading && <p className="mt-4 text-body text-fg-muted">Loading…</p>}

      {/* Flag queue */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-lead font-bold text-fg">
          <Flag className="h-5 w-5 text-brand-600" /> Flag queue
          {openFlags.length > 0 && <span className="rounded-full bg-error/15 px-2 py-0.5 text-caption font-bold text-error">{openFlags.length} open</span>}
        </h2>
        <div className="mt-3 space-y-3">
          {!loading && flags.length === 0 ? (
            <div className="card flex items-center gap-3 p-6 text-body text-fg-muted"><ShieldCheck className="h-5 w-5 text-success" /> No flags — all contributed data is consistent so far.</div>
          ) : (
            flags.map((f) => <FlagCard key={f.id} flag={f} />)
          )}
        </div>
      </section>

      {/* Contributor scores */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lead font-bold text-fg"><Users className="h-5 w-5 text-brand-600" /> Contributor scores</h2>
        <div className="card mt-3 overflow-hidden">
          {!loading && contributors.length === 0 ? (
            <p className="p-6 text-body text-fg-muted">No scored contributors yet.</p>
          ) : (
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border text-left text-caption uppercase tracking-wide text-fg-muted">
                  <th className="p-4">Contributor</th>
                  <th className="p-4">Trust score</th>
                  <th className="p-4">Updated</th>
                </tr>
              </thead>
              <tbody>
                {contributors.map((c) => {
                  const score = Number(c.score);
                  const tone = scoreTone(score);
                  return (
                    <tr key={c.userId} className="border-b border-border last:border-0">
                      <td className="p-4 text-fg">{c.email ?? c.userId}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-2">
                            <div className={`h-full ${tone.bar}`} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
                          </div>
                          <span className={`font-bold ${tone.text}`}>{score.toFixed(0)}%</span>
                          {score < 70 && <ShieldAlert className="h-4 w-4 text-error" />}
                        </div>
                      </td>
                      <td className="p-4 text-caption text-fg-muted">{new Date(c.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function FlagCard({ flag }: { flag: DataFlag }) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2 py-0.5 text-caption font-bold ${flagTone[flag.status] ?? "bg-surface-2 text-fg-muted"}`}>{flag.status}</span>
          <span className="font-semibold text-fg">{flag.field.replace(/_/g, " ")}</span>
          <span className="font-mono text-caption text-fg-muted">{flag.vin}</span>
        </div>
        <span className="text-caption text-fg-muted">{flag.entriesCount} entr{flag.entriesCount === 1 ? "y" : "ies"} · opened {new Date(flag.createdAt).toLocaleDateString()}</span>
      </div>

      {flag.resolvedValue && (
        <p className="mt-2 text-body text-fg">Resolved to <strong className="text-success">{flag.resolvedValue}</strong></p>
      )}

      {flag.claims.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {flag.claims.map((c) => {
            const isWinner = flag.resolvedValue != null && c.value === flag.resolvedValue;
            return (
              <div key={c.id} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-body ${isWinner ? "bg-success/10" : "bg-surface-2/50"}`}>
                <span className="font-medium text-fg">{c.value}</span>
                <span className="shrink-0 text-caption text-fg-muted">{c.email ?? c.userId ?? "unknown"} · {new Date(c.createdAt).toLocaleDateString()}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
