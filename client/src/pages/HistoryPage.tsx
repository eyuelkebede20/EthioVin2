// src/pages/HistoryPage.tsx
import { useLocation, useNavigate, useParams } from "react-router-dom";
import VehicleSpecsCard from "../components/VehicleSpecsCard";

export default function HistoryPage() {
  const { vin } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const vehicleData = location.state?.vehicleData;

  if (!vehicleData) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-xl font-bold text-red-500">No data found in memory.</h2>
        <button onClick={() => navigate("/scan")} className="mt-4 text-blue-500 underline">
          Go back to Scanner
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-10 p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            {vehicleData.year} {vehicleData.manufacturer} {vehicleData.model}
          </h1>
          <p className="text-slate-500 font-mono mt-1 text-lg">VIN: {vin}</p>
        </div>
        <button onClick={() => navigate("/scan")} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition">
          Scan New VIN
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Specific Ledger Instance (The Patient) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <h2 className="font-bold text-lg text-slate-800 mb-4 border-b pb-2">Ledger Instance</h2>

            {vehicleData.image_url ? (
              <img src={vehicleData.image_url} alt="Vehicle" className="w-full rounded-lg shadow-sm mb-4 object-cover" />
            ) : (
              <div className="w-full h-40 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400 mb-4 font-medium">No Image Provided</div>
            )}

            <div className="space-y-2 text-sm text-slate-600">
              <p className="flex justify-between">
                <strong>Scanned By:</strong> <span>{vehicleData.scannedBy || "System Admin"}</span>
              </p>
              <p className="flex justify-between">
                <strong>WMI (Make):</strong> <span className="font-mono">{vehicleData.wmi}</span>
              </p>
              <p className="flex justify-between">
                <strong>VDS (Hardware):</strong> <span className="font-mono">{vehicleData.vds}</span>
              </p>
              <p className="flex justify-between">
                <strong>VIS (Serial):</strong> <span className="font-mono">{vehicleData.vis}</span>
              </p>
              <p className="flex justify-between">
                <strong>Country:</strong> <span>{vehicleData.country}</span>
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Shared Hardware Specifications (The DNA) */}
        <div className="lg:col-span-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Hardware Specifications</h2>
          <p className="text-slate-500 mb-6 text-sm">
            These specifications are shared across all vehicles with the VDS code <span className="font-mono font-bold">{vehicleData.vds}</span>.
          </p>

          <VehicleSpecsCard specs={vehicleData.hardware_specs} />
        </div>
      </div>
    </div>
  );
}
