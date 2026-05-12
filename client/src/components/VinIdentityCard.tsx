// src/components/VinIdentityCard.tsx

interface VinIdentityCardProps {
  vin: string;
  manufacturer: string;
  year: string;
  country?: string;
}

export default function VinIdentityCard({ vin, manufacturer, year, country }: VinIdentityCardProps) {
  if (!vin || vin.length !== 17) return null;

  const wmi = vin.substring(0, 3);
  const vds = vin.substring(3, 8);
  const checkDigit = vin.substring(8, 9);
  const visYear = vin.substring(9, 10);
  const plant = vin.substring(10, 11);
  const serial = vin.substring(11, 17);

  return (
    <div className="bg-slate-800 text-white p-6 rounded-xl shadow-md mb-6">
      <div className="flex justify-between items-end mb-4 border-b border-slate-700 pb-4">
        <div>
          <h2 className="text-xl font-bold text-blue-400">Vehicle Identity</h2>
          <p className="text-slate-400 text-sm">
            {year} {manufacturer}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Scanned VIN</p>
          <p className="font-mono text-2xl font-bold tracking-widest">{vin}</p>
        </div>
      </div>

      {/* The Logical Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {/* WMI - Origin Identity */}
        <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
          <p className="text-xs text-slate-400 font-bold mb-1">WMI (Origin)</p>
          <p className="font-mono text-xl text-white">{wmi}</p>
          <p className="text-xs text-slate-300 mt-1">{country || manufacturer || "Unknown Origin"}</p>
        </div>

        {/* VDS - Hardware Decode Trigger */}
        <div className="bg-blue-900/40 p-3 rounded-lg border border-blue-700/50">
          <p className="text-xs text-blue-300 font-bold mb-1">VDS (Hardware DNA)</p>
          <p className="font-mono text-xl text-blue-100">{vds}</p>
          <p className="text-xs text-blue-200 mt-1">Triggers Specs Table</p>
        </div>

        {/* VIS Year & Plant - Specific Identity */}
        <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
          <p className="text-xs text-slate-400 font-bold mb-1">Year & Plant</p>
          <p className="font-mono text-xl text-white">
            <span className="text-green-400" title="Year Code">
              {visYear}
            </span>
            <span className="text-orange-400 ml-1" title="Plant Code">
              {plant}
            </span>
          </p>
          <p className="text-xs text-slate-300 mt-1">Model Year: {year}</p>
        </div>

        {/* VIS Serial - Specific Identity */}
        <div className="bg-slate-700/50 p-3 rounded-lg border border-slate-600">
          <p className="text-xs text-slate-400 font-bold mb-1">Serial (Chassis)</p>
          <p className="font-mono text-xl text-white">{serial}</p>
          <p className="text-xs text-slate-300 mt-1">Production #</p>
        </div>
      </div>
    </div>
  );
}
