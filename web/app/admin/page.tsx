"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/navs";
import { adminApi, ApiError, type Analytics } from "@/lib/api";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-5">
      <p className="text-caption font-bold uppercase tracking-wide text-fg-muted">{label}</p>
      <p className="mt-1 text-display text-fg">{value}</p>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [a, setA] = useState<Analytics | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    adminApi.getAnalytics().then(setA).catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to load analytics."));
  }, []);

  return (
    <AppShell title="Admin" nav={ADMIN_NAV} requireRole="super_admin">
      <h1 className="text-title text-fg">Analytics</h1>
      {err && <p className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}

      {a && (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Users" value={a.users} />
            <Stat label="Premium users" value={a.premiumUsers} />
            <Stat label="Payments succeeded" value={a.paymentsSucceeded} />
            <Stat label="Credits issued" value={a.creditsIssued} />
            <Stat label="Flags open" value={a.flagsOpen} />
            <Stat label="Flags resolved" value={a.flagsResolved} />
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="card p-6">
              <h2 className="text-lead font-bold text-fg">Organizations</h2>
              {a.orgsByType.length === 0 ? (
                <p className="mt-2 text-body text-fg-muted">None yet.</p>
              ) : (
                <table className="mt-3 w-full text-body">
                  <tbody>
                    {a.orgsByType.map((o) => (
                      <tr key={o.type} className="border-b border-border last:border-0">
                        <td className="py-2 text-fg">{o.type}</td>
                        <td className="py-2 text-right font-semibold text-fg">{o.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card p-6">
              <h2 className="text-lead font-bold text-fg">Vehicle events</h2>
              {a.eventsByType.length === 0 ? (
                <p className="mt-2 text-body text-fg-muted">None yet.</p>
              ) : (
                <table className="mt-3 w-full text-body">
                  <tbody>
                    {a.eventsByType.map((e) => (
                      <tr key={e.type} className="border-b border-border last:border-0">
                        <td className="py-2 text-fg">{e.type.replace(/_/g, " ")}</td>
                        <td className="py-2 text-right font-semibold text-fg">{e.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
