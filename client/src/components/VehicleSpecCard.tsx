import React from "react";

interface Props {
  data: any;
}

export default function VehicleSpecCard({ data }: Props) {
  const specs = data.vehicle_spec || data; // Adjust based on exactly how Drizzle joins the data
  const cache = data.vds_cache || data;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden text-left">
      <div className="bg-slate-50 border-b border-slate-200 p-6 flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-black text-slate-800">
            {specs.year} {specs.make || "Make"} {specs.model || "Model"}
          </h3>
          <p className="font-mono text-slate-500 mt-1">
            WMI: <span className="font-bold text-slate-700">{cache.wmi}</span> | VDS: <span className="font-bold text-slate-700">{cache.vds_code}</span>
          </p>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
            ${cache.status === "verified" ? "bg-green-100 text-green-700" : cache.status === "conflict" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}
          >
            {cache.status}
          </span>
        </div>
      </div>

      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Engine</p>
          <p className="text-lg font-bold text-slate-800">{specs.engine_cc} CC</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Fuel</p>
          <p className="text-lg font-bold text-slate-800 capitalize">{specs.fuel}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Transmission</p>
          <p className="text-lg font-bold text-slate-800 capitalize">{specs.transmission}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Body Style</p>
          <p className="text-lg font-bold text-slate-800 capitalize">{specs.body_style.replace("_", " ")}</p>
        </div>
      </div>
    </div>
  );
}
