"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/navs";
import { adminApi, ApiError } from "@/lib/api";

export default function AdminAgreementsPage() {
  // Create agreement
  const [orgId, setOrgId] = useState("");
  const [scopeText, setScopeText] = useState('{\n  "submit": ["insurance_claim", "police_report"],\n  "pull": ["decode", "health_grade"]\n}');
  const [createMsg, setCreateMsg] = useState("");
  const [createErr, setCreateErr] = useState("");

  // Revoke
  const [revokeId, setRevokeId] = useState("");
  const [revokeMsg, setRevokeMsg] = useState("");
  const [revokeErr, setRevokeErr] = useState("");

  const inputCls = "mt-1 w-full rounded-lg border border-border bg-bg p-2.5 text-body text-fg";

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErr(""); setCreateMsg("");
    let scope: Record<string, unknown>;
    try {
      scope = JSON.parse(scopeText);
    } catch {
      return setCreateErr("Scope must be valid JSON.");
    }
    try {
      const r = await adminApi.createAgreement({ orgId: orgId.trim(), scope });
      setCreateMsg(`Agreement created. ID: ${r.id}`);
    } catch (e2) {
      setCreateErr(e2 instanceof ApiError ? e2.message : "Failed to create agreement.");
    }
  };

  const revoke = async (e: React.FormEvent) => {
    e.preventDefault();
    setRevokeErr(""); setRevokeMsg("");
    try {
      await adminApi.revokeAgreement(revokeId.trim());
      setRevokeMsg("Agreement revoked.");
      setRevokeId("");
    } catch (e2) {
      setRevokeErr(e2 instanceof ApiError ? e2.message : "Failed to revoke.");
    }
  };

  return (
    <AppShell title="Admin" nav={ADMIN_NAV} requireRole="super_admin">
      <h1 className="text-title text-fg">Data-sharing agreements</h1>
      <p className="mt-1 text-body text-fg-muted">An active agreement is what unlocks an insurer&apos;s reciprocal exchange.</p>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <form onSubmit={create} className="card space-y-4 p-6">
          <h2 className="text-lead font-bold text-fg">Create agreement</h2>
          <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">Organization ID<input value={orgId} onChange={(e) => setOrgId(e.target.value)} className={`${inputCls} font-mono`} /></label>
          <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">Scope (JSON)
            <textarea value={scopeText} onChange={(e) => setScopeText(e.target.value)} rows={6} className={`${inputCls} font-mono text-caption`} />
          </label>
          {createErr && <p className="rounded-lg bg-error/10 px-3 py-2 text-body text-error">{createErr}</p>}
          {createMsg && <p className="rounded-lg bg-success/10 px-3 py-2 text-body text-success">{createMsg}</p>}
          <button className="btn-brand w-full">Create</button>
        </form>

        <form onSubmit={revoke} className="card space-y-4 p-6">
          <h2 className="text-lead font-bold text-fg">Revoke agreement</h2>
          <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">Agreement ID<input value={revokeId} onChange={(e) => setRevokeId(e.target.value)} className={`${inputCls} font-mono`} /></label>
          {revokeErr && <p className="rounded-lg bg-error/10 px-3 py-2 text-body text-error">{revokeErr}</p>}
          {revokeMsg && <p className="rounded-lg bg-success/10 px-3 py-2 text-body text-success">{revokeMsg}</p>}
          <button className="btn-ghost w-full">Revoke</button>
        </form>
      </div>
    </AppShell>
  );
}
