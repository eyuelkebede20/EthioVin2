import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Scanner from "../components/Scanner";
import VerificationForm from "../components/VerificationForm";
import Banner from "../components/ui/Banner";
import type { ScanResponse } from "../api/vinService";

export default function ScannerPage() {
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState<(ScanResponse & { vin: string }) | null>(null);
  const [saved, setSaved] = useState(false);

  const handleScanComplete = (result: ScanResponse & { vin: string }) => {
    setSaved(false);
    if (result.hit && result.patientExists) {
      // Exact VIN already in the ledger — go straight to its detail page.
      navigate(`/history/${result.vin}`, { state: { vehicleData: result.data } });
    } else {
      // Cache hit or new scan — show the verification form.
      setScanResult(result);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">VIN Decoder</h1>
        <p className="text-slate-500 mt-2">Decode a 17-digit VIN and verify its specifications.</p>
      </div>

      {saved && (
        <div className="max-w-3xl mx-auto mb-6">
          <Banner variant="success">Record saved successfully.</Banner>
        </div>
      )}

      {!scanResult ? (
        <Scanner onScanComplete={handleScanComplete} />
      ) : (
        <VerificationForm
          scanData={scanResult}
          onSuccess={() => {
            setSaved(true);
            setScanResult(null);
          }}
          onCancel={() => setScanResult(null)}
        />
      )}
    </div>
  );
}
