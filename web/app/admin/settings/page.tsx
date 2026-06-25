"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import AppShell from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/navs";
import { adminApi, ApiError } from "@/lib/api";

export default function AdminSettingsPage() {
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    adminApi.getSettings().then((s) => setPaymentsEnabled(s.paymentsEnabled)).catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to load settings."));
  }, []);

  const toggle = async () => {
    if (paymentsEnabled === null) return;
    setBusy(true); setErr("");
    try {
      const r = await adminApi.updateSettings({ paymentsEnabled: !paymentsEnabled });
      setPaymentsEnabled(r.paymentsEnabled);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to update.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Admin" nav={ADMIN_NAV} requireRole="super_admin">
      <h1 className="text-title text-fg">Settings</h1>
      {err && <p className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}

      <div className="card mt-5 flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
            <CreditCard className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lead font-bold text-fg">Payments</h2>
            <p className="mt-1 max-w-md text-body text-fg-muted">
              When off, users can&apos;t start a premium checkout (the upgrade button is hidden and
              `/payments/init` returns 503). In-flight provider webhooks still complete.
            </p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={busy || paymentsEnabled === null}
          role="switch"
          aria-checked={paymentsEnabled ?? false}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-fast ${paymentsEnabled ? "bg-brand-500" : "bg-surface-2 border border-border"}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all duration-fast ${paymentsEnabled ? "left-7" : "left-1"}`} />
        </button>
      </div>
      {paymentsEnabled !== null && (
        <p className="mt-3 text-body text-fg-muted">Payments are currently <strong className={paymentsEnabled ? "text-success" : "text-error"}>{paymentsEnabled ? "enabled" : "disabled"}</strong>.</p>
      )}
    </AppShell>
  );
}
