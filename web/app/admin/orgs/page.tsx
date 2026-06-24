"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/navs";
import { adminApi, ApiError, type Organization } from "@/lib/api";

const ORG_TYPES = ["garage", "insurer", "diagnostic"];

export default function AdminOrgsPage() {
  // Create org
  const [name, setName] = useState("");
  const [type, setType] = useState("garage");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [created, setCreated] = useState<Organization | null>(null);
  const [orgErr, setOrgErr] = useState("");

  // Add member
  const [orgId, setOrgId] = useState("");
  const [email, setEmail] = useState("");
  const [orgRole, setOrgRole] = useState("member");
  const [memberMsg, setMemberMsg] = useState("");
  const [memberErr, setMemberErr] = useState("");

  const inputCls = "mt-1 w-full rounded-lg border border-border bg-bg p-2.5 text-body text-fg";

  const submitOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgErr(""); setCreated(null);
    if (!name.trim()) return setOrgErr("Name is required.");
    try {
      const org = await adminApi.createOrg({ name: name.trim(), type, country: country.trim() || undefined, city: city.trim() || undefined });
      setCreated(org);
      setOrgId(org.id); // convenience: prefill the member form
      setName(""); setCountry(""); setCity("");
    } catch (e2) {
      setOrgErr(e2 instanceof ApiError ? e2.message : "Failed to create org.");
    }
  };

  const submitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberErr(""); setMemberMsg("");
    try {
      await adminApi.addOrgMember({ orgId: orgId.trim(), email: email.trim(), orgRole: orgRole.trim() || undefined });
      setMemberMsg("Member added.");
      setEmail("");
    } catch (e2) {
      setMemberErr(e2 instanceof ApiError ? e2.message : "Failed to add member.");
    }
  };

  return (
    <AppShell title="Admin" nav={ADMIN_NAV} requireRole="super_admin">
      <h1 className="text-title text-fg">Organizations</h1>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <form onSubmit={submitOrg} className="card space-y-4 p-6">
          <h2 className="text-lead font-bold text-fg">Create organization</h2>
          <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">Name<input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></label>
          <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">Type
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>{ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">Country<input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} /></label>
            <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">City<input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} /></label>
          </div>
          {orgErr && <p className="rounded-lg bg-error/10 px-3 py-2 text-body text-error">{orgErr}</p>}
          {created && <p className="rounded-lg bg-success/10 px-3 py-2 text-body text-success">Created. ID: <span className="font-mono">{created.id}</span></p>}
          <button className="btn-brand w-full">Create</button>
        </form>

        <form onSubmit={submitMember} className="card space-y-4 p-6">
          <h2 className="text-lead font-bold text-fg">Add member</h2>
          <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">Organization ID<input value={orgId} onChange={(e) => setOrgId(e.target.value)} className={`${inputCls} font-mono`} /></label>
          <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">User email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputCls} /></label>
          <label className="block text-caption font-bold uppercase tracking-wide text-fg-muted">Org role<input value={orgRole} onChange={(e) => setOrgRole(e.target.value)} className={inputCls} /></label>
          {memberErr && <p className="rounded-lg bg-error/10 px-3 py-2 text-body text-error">{memberErr}</p>}
          {memberMsg && <p className="rounded-lg bg-success/10 px-3 py-2 text-body text-success">{memberMsg}</p>}
          <button className="btn-brand w-full">Add member</button>
        </form>
      </div>
    </AppShell>
  );
}
