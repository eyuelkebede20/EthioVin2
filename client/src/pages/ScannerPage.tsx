import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Scanner from "../components/Scanner";
import VerificationForm from "../components/VerificationForm";
import type { ScanResponse } from "../api/vinService";

export default function ScannerPage() {
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState<(ScanResponse & { vin: string }) | null>(null);

  const handleScanComplete = (result: ScanResponse & { vin: string }) => {
    if (result.patientExists && result.data) {
      // BRAIN 1: Identity match found
      navigate(`/history/${result.vin}`, { state: { vehicleData: result.data } });
    } else {
      // BRAIN 2: DNA match or New Scan
      setScanResult(result);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* ... header ... */}
      {!scanResult ? (
        <Scanner onScanComplete={handleScanComplete} />
      ) : (
        <VerificationForm
          scanData={scanResult}
          onSuccess={() => {
            alert("Record successfully saved.");
            setScanResult(null);
          }}
          onCancel={() => setScanResult(null)}
        />
      )}
    </div>
  );
}
