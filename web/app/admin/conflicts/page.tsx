"use client";

import { useCallback, useEffect, useState } from "react";
import { GitMerge, Check, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { ADMIN_NAV } from "@/lib/navs";
import { conflictApi, ApiError, type ConflictRow } from "@/lib/api";

const humanize = (s: string) => s.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()).trim();

interface ConflictGroup {
  wmi: string;
  vds_code: string;
  currentSpecId: string;
  candidates: { specId: string; specs: Record<string, unknown> }[];
}

// The /vin/conflicts endpoint returns flat joined rows (one per logged proposal).
// Group them by (wmi, vds_code) and dedupe candidate specs by id; mark the spec
// currently on the cache row as the baseline.
function group(rows: ConflictRow[]): ConflictGroup[] {
  const map = new Map<string, ConflictGroup>();
  for (const r of rows) {
    const { wmi, vds_code, spec_id } = r.vds_cache;
    const key = `${wmi}|${vds_code}`;
    let g = map.get(key);
    if (!g) { g = { wmi, vds_code, currentSpecId: spec_id, candidates: [] }; map.set(key, g); }
    const spec = r.vehicle_specs;
    if (spec && !g.candidates.some((c) => c.specId === spec.id)) {
      g.candidates.push({ specId: spec.id, specs: spec.hardware_specs ?? {} });
    }
  }
  // Ensure the current/baseline spec is always selectable even if it had no log row.
  for (const g of map.values()) {
    if (!g.candidates.some((c) => c.specId === g.currentSpecId)) {
      g.candidates.unshift({ specId: g.currentSpecId, specs: {} });
    }
  }
  return [...map.values()];
}

export default function AdminConflictsPage() {
  const [groups, setGroups] = useState<ConflictGroup[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    conflictApi.list()
      .then((rows) => setGroups(group(rows)))
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to load conflicts."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  const resolve = async (g: ConflictGroup, specId: string) => {
    setBusyKey(`${g.wmi}|${g.vds_code}`); setErr("");
    try {
      await conflictApi.resolve({ wmi: g.wmi, vds_code: g.vds_code, selected_spec_id: specId });
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to resolve.");
    } finally {
      setBusyKey("");
    }
  };

  return (
    <AppShell title="Admin" nav={ADMIN_NAV} requireRole="super_admin">
      <h1 className="text-title text-fg">Spec conflicts</h1>
      <p className="mt-1 text-body text-fg-muted">
        When a differing spec is submitted for an already-verified model, the original is kept and the
        proposal recorded here. Pick the correct spec to re-verify the model.
      </p>
      {err && <p className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{err}</p>}

      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="text-body text-fg-muted">Loading…</p>
        ) : groups.length === 0 ? (
          <div className="card flex items-center gap-3 p-6 text-body text-fg-muted"><ShieldCheck className="h-5 w-5 text-success" /> No open conflicts.</div>
        ) : (
          groups.map((g) => {
            const key = `${g.wmi}|${g.vds_code}`;
            return (
              <div key={key} className="card p-5">
                <div className="flex items-center gap-2">
                  <GitMerge className="h-5 w-5 text-brand-600" />
                  <span className="font-mono text-body font-semibold text-fg">{g.wmi} · {g.vds_code}</span>
                  <span className="rounded-full bg-error/15 px-2 py-0.5 text-caption font-bold text-error">{g.candidates.length} candidate specs</span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {g.candidates.map((c) => (
                    <div key={c.specId} className={`rounded-xl border p-4 ${c.specId === g.currentSpecId ? "border-brand-300 bg-brand-50/40" : "border-border"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-caption font-bold uppercase tracking-wide text-fg-muted">
                          {c.specId === g.currentSpecId ? "Current (verified)" : "Proposed"}
                        </span>
                        <button
                          onClick={() => resolve(g, c.specId)}
                          disabled={busyKey === key}
                          className="btn-brand !px-3 !py-1.5 text-caption"
                        >
                          <Check className="h-4 w-4" /> Use this
                        </button>
                      </div>
                      <SpecPreview specs={c.specs} />
                      <p className="mt-2 font-mono text-caption text-fg-muted">spec {c.specId.slice(0, 8)}…</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </AppShell>
  );
}

function SpecPreview({ specs }: { specs: Record<string, unknown> }) {
  const sections = Object.entries(specs).filter(([, v]) => v && typeof v === "object");
  if (sections.length === 0) return <p className="mt-3 text-caption text-fg-muted">No detail loaded (baseline spec).</p>;
  return (
    <div className="mt-3 space-y-2">
      {sections.map(([section, fields]) => (
        <div key={section}>
          <p className="text-caption font-bold text-fg">{humanize(section)}</p>
          <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
            {Object.entries(fields as Record<string, unknown>).slice(0, 6).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 text-caption">
                <dt className="truncate text-fg-muted">{humanize(k)}</dt>
                <dd className="shrink-0 font-medium text-fg">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
