import { useEffect, useState } from "react";
import { getConflicts, resolveConflict, type ConflictJoinRow } from "../../api/vinService";
import { ApiError } from "../../api/client";
import Banner from "../ui/Banner";

interface Proposal {
  spec_id: number;
  admin_id: string;
  specs: Record<string, unknown>;
  timestamp: string | null;
}
interface ConflictGroup {
  wmi: string;
  vds_code: string;
  proposals: Proposal[];
}

function group(rows: ConflictJoinRow[]): ConflictGroup[] {
  const map = new Map<string, ConflictGroup>();
  for (const row of rows) {
    const key = `${row.vds_cache.wmi}-${row.vds_cache.vds_code}`;
    let entry = map.get(key);
    if (!entry) {
      entry = { wmi: row.vds_cache.wmi, vds_code: row.vds_cache.vds_code, proposals: [] };
      map.set(key, entry);
    }
    if (row.vehicle_specs && row.verification_log) {
      entry.proposals.push({
        spec_id: row.vehicle_specs.id,
        admin_id: row.verification_log.admin_id,
        specs: row.vehicle_specs.hardware_specs,
        timestamp: row.verification_log.timestamp,
      });
    }
  }
  return Array.from(map.values());
}

export default function ConflictsPanel() {
  const [conflicts, setConflicts] = useState<ConflictGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = group(await getConflicts());
        if (active) setConflicts(data);
      } catch (e) {
        if (active) setError(e instanceof ApiError ? e.message : "Failed to load conflicts.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleResolve = async (wmi: string, vds_code: string, selected_spec_id: number) => {
    setError("");
    try {
      await resolveConflict({ wmi, vds_code, selected_spec_id });
      setConflicts(group(await getConflicts()));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to resolve conflict.");
    }
  };

  if (loading) return <div className="p-4 bg-white rounded shadow text-slate-500">Loading conflicts…</div>;

  return (
    <div className="bg-white p-6 rounded shadow border border-slate-200">
      <h2 className="text-xl font-bold mb-4">Conflict Resolution</h2>
      {error && (
        <div className="mb-4">
          <Banner variant="error">{error}</Banner>
        </div>
      )}

      {conflicts.length === 0 ? (
        <p className="text-slate-500">No conflicts pending review.</p>
      ) : (
        <div className="space-y-8">
          {conflicts.map((c) => (
            <div key={`${c.wmi}-${c.vds_code}`} className="border border-red-200 rounded-2xl overflow-hidden">
              <div className="bg-red-50 p-4 border-b border-red-200 font-bold text-red-800 font-mono">
                WMI: {c.wmi} · VDS: {c.vds_code}
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {c.proposals.map((p) => (
                  <div key={p.spec_id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <p className="text-xs text-slate-500 mb-2">Submitted by {p.admin_id}</p>
                    <pre className="text-xs bg-white border rounded p-2 mb-4 max-h-48 overflow-auto">{JSON.stringify(p.specs, null, 2)}</pre>
                    <button
                      onClick={() => handleResolve(c.wmi, c.vds_code, p.spec_id)}
                      className="w-full py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 text-sm"
                    >
                      Approve this spec
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
