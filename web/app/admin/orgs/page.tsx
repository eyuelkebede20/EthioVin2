"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, ChevronDown, Plus, UserPlus, FileSignature, X } from "lucide-react";
import AppShell from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/navs";
import { adminApi, ApiError, type OrgListItem, type OrgDetail } from "@/lib/api";

const ORG_TYPES = ["garage", "insurer", "diagnostic"];
const inputCls = "mt-1 w-full rounded-lg border border-border bg-bg p-2.5 text-body text-fg";
const typeChip: Record<string, string> = {
  garage: "bg-brand-100 text-brand-700",
  insurer: "bg-info/15 text-info",
  diagnostic: "bg-success/15 text-success",
};

export default function AdminOrgsPage() {
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .listOrgs()
      .then((o) => setOrgs(o))
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to load organizations."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  return (
    <AppShell title="Admin" nav={ADMIN_NAV} requireRole="super_admin">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-title text-fg">Organizations</h1>
          <p className="mt-1 text-body text-fg-muted">Onboard garages, insurers and diagnostic partners; manage members and data-sharing agreements.</p>
        </div>
        <button onClick={() => setShowCreate((v) => !v)} className="btn-brand shrink-0">
          <Plus className="h-5 w-5" /> New org
        </button>
      </div>

      {err && <p className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}

      {showCreate && <CreateOrgForm onCreated={() => { setShowCreate(false); load(); }} />}

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-body text-fg-muted">Loading…</p>
        ) : orgs.length === 0 ? (
          <div className="card p-10 text-center">
            <Building2 className="mx-auto h-8 w-8 text-fg-muted" />
            <p className="mt-2 text-body text-fg-muted">No organizations yet. Create one to start onboarding partners.</p>
          </div>
        ) : (
          orgs.map((o) => (
            <OrgRow key={o.id} org={o} open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? null : o.id)} onChanged={load} />
          ))
        )}
      </div>
    </AppShell>
  );
}

function CreateOrgForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("garage");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Name is required.");
    setBusy(true);
    try {
      await adminApi.createOrg({ name: name.trim(), type, country: country.trim() || undefined, city: city.trim() || undefined });
      onCreated();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to create org.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card mt-4 space-y-4 p-6">
      <h2 className="text-lead font-bold text-fg">Create organization</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">Name<input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></label>
        <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">Type
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>{ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        </label>
        <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">Country<input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} /></label>
        <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">City<input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} /></label>
      </div>
      {err && <p className="rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}
      <button disabled={busy} className="btn-brand">{busy ? "Creating…" : "Create organization"}</button>
    </form>
  );
}

function OrgRow({ org, open, onToggle, onChanged }: { org: OrgListItem; open: boolean; onToggle: () => void; onChanged: () => void }) {
  return (
    <div className="card overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-surface-2/50">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-fg-muted"><Building2 className="h-5 w-5" /></span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lead font-bold text-fg">{org.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-caption font-bold ${typeChip[org.type] ?? "bg-surface-2 text-fg-muted"}`}>{org.type}</span>
              {org.status !== "active" && <span className="rounded-full bg-error/15 px-2 py-0.5 text-caption font-bold text-error">{org.status}</span>}
            </div>
            <p className="mt-0.5 text-caption text-fg-muted">
              {[org.city, org.country].filter(Boolean).join(", ") || "—"} · {org.memberCount} member{org.memberCount === 1 ? "" : "s"} · {org.activeAgreements} active agreement{org.activeAgreements === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-fg-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <OrgDetailPanel orgId={org.id} orgType={org.type} onChanged={onChanged} />}
    </div>
  );
}

function OrgDetailPanel({ orgId, orgType, onChanged }: { orgId: string; orgType: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    adminApi.getOrg(orgId).then(setDetail).catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to load org."));
  }, [orgId]);
  useEffect(() => load(), [load]);

  return (
    <div className="border-t border-border bg-surface-2/30 p-5">
      <p className="text-caption text-fg-muted">Org ID <span className="select-all font-mono text-fg">{orgId}</span></p>
      {err && <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <MembersSection detail={detail} orgId={orgId} onChanged={() => { load(); onChanged(); }} />
        <AgreementsSection detail={detail} orgId={orgId} orgType={orgType} onChanged={() => { load(); onChanged(); }} />
      </div>
    </div>
  );
}

function MembersSection({ detail, orgId, onChanged }: { detail: OrgDetail | null; orgId: string; onChanged: () => void }) {
  const [email, setEmail] = useState("");
  const [orgRole, setOrgRole] = useState("member");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      await adminApi.addOrgMember({ orgId, email: email.trim(), orgRole: orgRole.trim() || undefined });
      setMsg("Member added."); setEmail(""); onChanged();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to add member.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h3 className="flex items-center gap-2 text-body font-bold text-fg"><UserPlus className="h-4 w-4 text-brand-600" /> Members</h3>
      <div className="mt-2 space-y-1.5">
        {!detail ? (
          <p className="text-caption text-fg-muted">Loading…</p>
        ) : detail.members.length === 0 ? (
          <p className="text-caption text-fg-muted">No members yet.</p>
        ) : (
          detail.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg bg-bg px-3 py-2 text-body">
              <span className="truncate text-fg">{m.email ?? m.userId}</span>
              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-caption font-semibold text-fg-muted">{m.orgRole}</span>
            </div>
          ))
        )}
      </div>
      <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-[160px] flex-1 text-caption font-bold uppercase tracking-wide text-fg-muted">User email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className={inputCls} /></label>
        <label className="text-caption font-bold uppercase tracking-wide text-fg-muted">Role
          <select value={orgRole} onChange={(e) => setOrgRole(e.target.value)} className={inputCls}><option value="member">member</option><option value="admin">admin</option></select>
        </label>
        <button disabled={busy} className="btn-brand">Add</button>
      </form>
      {err && <p className="mt-2 text-caption text-error">{err}</p>}
      {msg && <p className="mt-2 text-caption text-success">{msg}</p>}
    </div>
  );
}

function AgreementsSection({ detail, orgId, orgType, onChanged }: { detail: OrgDetail | null; orgId: string; orgType: string; onChanged: () => void }) {
  const defaultScope = orgType === "insurer"
    ? '{\n  "submit": ["insurance_claim", "police_report"],\n  "pull": ["decode", "health_grade"]\n}'
    : '{\n  "submit": [],\n  "pull": ["decode"]\n}';
  const [scopeText, setScopeText] = useState(defaultScope);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    let scope: Record<string, unknown>;
    try { scope = JSON.parse(scopeText); } catch { return setErr("Scope must be valid JSON."); }
    setBusy(true);
    try {
      await adminApi.createAgreement({ orgId, scope });
      setShowForm(false); onChanged();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Failed to create agreement.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    try { await adminApi.revokeAgreement(id); onChanged(); } catch { /* surfaced on reload */ }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-body font-bold text-fg"><FileSignature className="h-4 w-4 text-brand-600" /> Data-sharing agreements</h3>
        <button onClick={() => setShowForm((v) => !v)} className="text-caption font-bold text-brand-600 hover:underline">{showForm ? "Cancel" : "+ New"}</button>
      </div>
      <p className="mt-1 text-caption text-fg-muted">An active agreement is the lawful basis that unlocks an insurer&apos;s reciprocal exchange.</p>

      <div className="mt-2 space-y-1.5">
        {!detail ? (
          <p className="text-caption text-fg-muted">Loading…</p>
        ) : detail.agreements.length === 0 ? (
          <p className="text-caption text-fg-muted">No agreements yet.</p>
        ) : (
          detail.agreements.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg bg-bg px-3 py-2">
              <div className="min-w-0">
                <span className={`rounded-full px-2 py-0.5 text-caption font-bold ${a.status === "active" ? "bg-success/15 text-success" : "bg-surface-2 text-fg-muted"}`}>{a.status}</span>
                <code className="mt-1 block truncate text-caption text-fg-muted">{JSON.stringify(a.scope)}</code>
              </div>
              {a.status === "active" && (
                <button onClick={() => revoke(a.id)} title="Revoke" className="shrink-0 rounded-lg p-1.5 text-fg-muted hover:bg-error/10 hover:text-error"><X className="h-4 w-4" /></button>
              )}
            </div>
          ))
        )}
      </div>

      {showForm && (
        <form onSubmit={create} className="mt-3 space-y-2">
          <textarea value={scopeText} onChange={(e) => setScopeText(e.target.value)} rows={5} className={`${inputCls} font-mono text-caption`} />
          {err && <p className="text-caption text-error">{err}</p>}
          <button disabled={busy} className="btn-brand">{busy ? "Creating…" : "Create agreement"}</button>
        </form>
      )}
    </div>
  );
}
