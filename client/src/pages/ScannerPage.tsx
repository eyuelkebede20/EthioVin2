import { useState } from "react";
import Scanner from "../components/Scanner";
import VerificationForm from "../components/VerificationForm";
import type { ScanResponse } from "../api/vinService";

export default function ScannerPage() {
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  // Add a state to track if we are in edit mode
  const [isEditing, setIsEditing] = useState(false);

  const handleReset = () => {
    setScanResult(null);
    setIsEditing(false);
  };
  const showScanner = !scanResult;
  const showVerification = scanResult && (scanResult.promptAdmin || isEditing);
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center text-slate-800 mb-2">EthioVin Decoder</h1>
      <p className="text-center text-slate-500 mb-8">System Cache & Verification</p>

      {showScanner && <Scanner onScanComplete={setScanResult} />}

      {showVerification && (
        <VerificationForm
          scanData={scanResult}
          initialSpecs={isEditing && scanResult.data ? scanResult.data.vehicle_specs || scanResult.data.vehicle_spec : undefined}
          onSuccess={() => {
            alert(`Specification ${isEditing ? "updated" : "saved"}.`);
            handleReset();
          }}
          onCancel={() => (isEditing ? setIsEditing(false) : handleReset())}
        />
      )}

      {/* Cache Hit View */}
    </div>
  );
}
