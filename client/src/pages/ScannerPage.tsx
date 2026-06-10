import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Scanner from "../components/Scanner";
import VerificationForm from "../components/VerificationForm";
import Banner from "../components/ui/Banner";
import type { ScanResponse } from "../api/vinService";

type ScanWithVin = ScanResponse & { vin: string };

export default function ScannerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Allow the detail page to send the user back here to record an exact VIN whose
  // specs were matched only by WMI+VDS (a cache hit). ScannerPage mounts fresh on
  // that navigation, so reading it as the initial state is enough.
  const navState = location.state as { resumeScan?: ScanWithVin } | null;
  const [scanResult, setScanResult] = useState<ScanWithVin | null>(navState?.resumeScan ?? null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Clear the one-shot navigation state so a refresh doesn't re-open the form.
    if (navState?.resumeScan) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScanComplete = (result: ScanWithVin) => {
    setSaved(false);

    if (result.hit && result.patientExists) {
      // Exact VIN already in the ledger — show its full detail page.
      navigate(`/history/${result.vin}`, { state: { vehicleData: result.data } });
      return;
    }

    if (result.hit) {
      // Cache hit: same WMI+VDS = same model. Specs/model/image are shared; only
      // the VIS differs. Show the full car (using a sibling ledger row for model +
      // image) instead of the add form. Year stays per-VIN (decoded from the VIN).
      const ed = result.extractedData;
      const ref = result.reference;
      const vehicleData = {
        vin: result.vin,
        manufacturer: ref?.manufacturer || ed.manufacturer,
        year: ed.year !== "Unknown" ? ed.year : ref?.year || ed.year,
        model: ref?.model || "",
        wmi: ed.wmi,
        vds: ed.vds_code,
        vis: result.vin.substring(9),
        country: null,
        image_url: ref?.image_url ?? null,
        scannedBy: null,
        hardware_specs: result.data.hardware_specs ?? {},
      };
      navigate(`/history/${result.vin}`, { state: { vehicleData, fromCache: true, scanResult: result } });
      return;
    }

    // Miss — no WMI+VDS match. Show the verification form to add a new model.
    setScanResult(result);
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
