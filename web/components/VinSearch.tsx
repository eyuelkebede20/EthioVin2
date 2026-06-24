"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

// Mirrors the server VIN rule: uppercase, strip non-alphanumerics, KEEP I/O/Q
// (imported ASEAN VINs legitimately contain O), cap at 17. The server re-derives
// the canonical key via parseVin — this is just input hygiene.
const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17);

export default function VinSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [vin, setVin] = useState("");
  const ready = vin.length === 17;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ready) router.push(`/decode/${vin}`);
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fg-muted" />
          <input
            value={vin}
            onChange={(e) => setVin(clean(e.target.value))}
            placeholder="Enter a 17-character VIN"
            autoFocus={autoFocus}
            inputMode="text"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full rounded-lg border border-border bg-bg py-3.5 pl-12 pr-4 font-mono text-lead tracking-wide text-fg shadow-sm transition focus:border-brand-400"
            aria-label="VIN"
          />
        </div>
        <button type="submit" disabled={!ready} className="btn-brand py-3.5 text-lead">
          Decode
        </button>
      </div>
      <p className="mt-2 pl-1 text-caption text-fg-muted">{vin.length}/17 characters{vin.length > 0 && !ready ? " — keep going" : ""}</p>
    </form>
  );
}
