import Link from "next/link";
import { Car, Lock, FileClock } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { fetchFreeDecode, ApiError, type FreeDecodeView } from "@/lib/api";

const humanize = (s: string) =>
  s
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

export default async function DecodePage({ params }: { params: Promise<{ vin: string }> }) {
  const { vin } = await params;

  let data: FreeDecodeView | null = null;
  let error: string | null = null;
  try {
    data = await fetchFreeDecode(vin);
  } catch (e) {
    error = e instanceof ApiError ? e.message : "Could not decode this VIN.";
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        {!data ? (
          <div className="card p-10 text-center">
            <h1 className="text-title text-fg">Couldn&apos;t decode that VIN</h1>
            <p className="mt-2 text-body text-fg-muted">{error}</p>
            <Link href="/" className="btn-brand mt-6 inline-flex">
              Try another VIN
            </Link>
          </div>
        ) : (
          <DecodeResult vin={vin} data={data} />
        )}
      </main>
    </>
  );
}

function DecodeResult({ vin, data }: { vin: string; data: FreeDecodeView }) {
  const v = data.vehicle;
  const title = [v.year && v.year !== "Unknown" ? v.year : null, v.manufacturer, v.model].filter(Boolean).join(" ") || "Unknown vehicle";
  const specSections = Object.entries(data.specs);

  return (
    <>
      {/* Identity */}
      <div className="card overflow-hidden">
        <div className="grid sm:grid-cols-3">
          <div className="flex items-center justify-center bg-surface-2 p-4 sm:min-h-[200px]">
            {v.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.image_url} alt={title} className="max-h-48 w-full rounded object-cover" />
            ) : (
              <div className="flex h-32 w-full flex-col items-center justify-center gap-2 text-fg-muted">
                <Car className="h-8 w-8" />
                <span className="text-caption">No image yet</span>
              </div>
            )}
          </div>
          <div className="p-6 sm:col-span-2">
            <span className="text-caption font-bold uppercase tracking-wide text-brand-600">Free decode</span>
            <h1 className="mt-1 text-display text-fg">{title}</h1>
            <p className="mt-1 font-mono text-body text-fg-muted">VIN {vin}</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-body sm:grid-cols-3">
              {[
                ["WMI", v.wmi],
                ["VDS", v.vds],
                ["Serial", v.vis],
                ["Origin", v.country],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-caption uppercase tracking-wide text-fg-muted">{label}</dt>
                  <dd className="font-mono text-fg">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Basic spec teaser */}
      {specSections.length > 0 && (
        <section className="mt-8">
          <h2 className="text-title text-fg">Basics</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {specSections.map(([section, fields]) => (
              <div key={section} className="card p-5">
                <h3 className="text-lead font-bold text-fg">{humanize(section)}</h3>
                <dl className="mt-3 space-y-2">
                  {Object.entries(fields as Record<string, unknown>).map(([k, val]) => (
                    <div key={k} className="flex justify-between gap-4 text-body">
                      <dt className="text-fg-muted">{humanize(k)}</dt>
                      <dd className="font-semibold text-fg">{String(val)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Paywall */}
      <section className="mt-8">
        <div className="card relative overflow-hidden border-brand-200 p-7">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-50 to-transparent" />
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-brand">
                <Lock className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lead font-bold text-fg">
                  {data.historyAvailable > 0 ? (
                    <span className="inline-flex items-center gap-2">
                      <FileClock className="h-5 w-5 text-brand-600" />
                      {data.historyAvailable} history record{data.historyAvailable === 1 ? "" : "s"} on file
                    </span>
                  ) : (
                    "Full report & history"
                  )}
                </h2>
                <p className="mt-1 max-w-md text-body text-fg-muted">
                  Unlock full specifications, the complete service &amp; odometer history, inspections and a vehicle
                  health grade.
                </p>
              </div>
            </div>
            <Link href={`/login?next=/decode/${vin}`} className="btn-brand shrink-0">
              Unlock with premium
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
