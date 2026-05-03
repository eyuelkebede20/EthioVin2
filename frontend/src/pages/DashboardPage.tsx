import { useEffect, useState } from "react";
import { vinService } from "../api/vinService";

export default function DashboardPage() {
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConflicts = async () => {
    try {
      const data = await vinService.getConflicts();

      // Grouping the flat SQL join results by WMI + VDS_CODE
      const grouped = data.reduce((acc: any, row: any) => {
        const key = `${row.vds_cache.wmi}-${row.vds_cache.vds_code}`;
        if (!acc[key]) {
          acc[key] = { wmi: row.vds_cache.wmi, vds_code: row.vds_cache.vds_code, proposals: [] };
        }
        acc[key].proposals.push({
          spec_id: row.vehicle_specs.id,
          admin_id: row.verification_log.admin_id,
          engine_cc: row.vehicle_specs.engine_cc,
          fuel: row.vehicle_specs.fuel,
          transmission: row.vehicle_specs.transmission,
          body_style: row.vehicle_specs.body_style,
          timestamp: row.verification_log.timestamp,
        });
        return acc;
      }, {});

      setConflicts(Object.values(grouped));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, []);

  const handleResolve = async (wmi: string, vds_code: string, spec_id: number) => {
    await vinService.resolveConflict(wmi, vds_code, spec_id);
    fetchConflicts(); // Refresh list
  };

  if (loading) return <div className="text-center mt-20 font-bold">Loading conflicts...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-6 border-b pb-4">Conflict Resolution</h1>
      {conflicts.length === 0 ? (
        <p className="text-slate-500">No conflicts pending review.</p>
      ) : (
        <div className="space-y-8">
          {conflicts.map((c: any) => (
            <div key={`${c.wmi}-${c.vds_code}`} className="bg-white border border-red-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-red-50 p-4 border-b border-red-200 font-bold text-red-800">
                WMI: {c.wmi} | VDS: {c.vds_code}
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {c.proposals.map((p: any, idx: number) => (
                  <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <p className="text-xs text-slate-500 mb-2">Submitted by Admin #{p.admin_id}</p>
                    <ul className="text-sm space-y-1 mb-4 font-medium">
                      <li>Engine: {p.engine_cc} CC</li>
                      <li>Fuel: {p.fuel}</li>
                      <li>Transmission: {p.transmission}</li>
                      <li>Body: {p.body_style}</li>
                    </ul>
                    <button onClick={() => handleResolve(c.wmi, c.vds_code, p.spec_id)} className="w-full py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 text-sm">
                      APPROVE THIS SPEC
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
