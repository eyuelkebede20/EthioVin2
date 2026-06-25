import Link from "next/link";
import { cookies } from "next/headers";
import { Car, Lock, FileClock } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import {
  fetchFreeDecode,
  fetchPremiumDecode,
  ApiError,
  type FreeDecodeView,
  type PremiumDecodeView,
} from "@/lib/api";

const humanize = (s: string) =>
  s
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

export default async function DecodePage({ params }: { params: Promise<{ vin: string }> }) {
  const { vin } = await params;

  // Forward the visitor's cookies — a server-side fetch carries no browser cookie
  // jar, so without this the API can never see the session and every visitor looks
  // anonymous. Build the header from the incoming request cookies.
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // If the visitor holds an active premium entitlement, the backend returns the full
  // report; 402 means logged-in-but-not-premium, 401/anything-else means anonymous.
  // Either way we fall back to the free teaser + paywall.
  let premium: PremiumDecodeView | null = null;
  let loggedInNotPremium = false;
  if (cookieHeader) {
    try {
      premium = await fetchPremiumDecode(vin, cookieHeader);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) loggedInNotPremium = true;
    }
  }

  let free: FreeDecodeView | null = null;
  let error: string | null = null;
  if (!premium) {
    try {
      free = await fetchFreeDecode(vin);
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Could not decode this VIN.";
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        {premium ? (
          <PremiumDecodeResult vin={vin} data={premium} />
        ) : !free ? (
          <div className="card p-10 text-center">
            <h1 className="text-title text-fg">Couldn&apos;t decode that VIN</h1>
            <p className="mt-2 text-body text-fg-muted">{error}</p>
            <Link href="/" className="btn-brand mt-6 inline-flex">
              Try another VIN
            </Link>
          </div>
        ) : (
          <DecodeResult vin={vin} data={free} loggedInNotPremium={loggedInNotPremium} />
        )}
      </main>
    </>
  );
}

function VehicleIdentityCard({
  vin,
  title,
  image_url,
  badge,
  wmi,
  vds,
  vis,
  country,
}: {
  vin: string;
  title: string;
  image_url?: string | null;
  badge: string;
  wmi?: string | null;
  vds?: string | null;
  vis?: string | null;
  country?: string | null;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="grid sm:grid-cols-3">
        <div className="flex items-center justify-center bg-surface-2 p-4 sm:min-h-[200px]">
          {image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image_url} alt={title} className="max-h-48 w-full rounded object-cover" />
          ) : (
            <div className="flex h-32 w-full flex-col items-center justify-center gap-2 text-fg-muted">
              <Car className="h-8 w-8" />
              <span className="text-caption">No image yet</span>
            </div>
          )}
        </div>
        <div className="p-6 sm:col-span-2">
          <span className="text-caption font-bold uppercase tracking-wide text-brand-600">{badge}</span>
          <h1 className="mt-1 text-display text-fg">{title}</h1>
          <p className="mt-1 font-mono text-body text-fg-muted">VIN {vin}</p>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-body sm:grid-cols-3">
            {[
              ["WMI", wmi],
              ["VDS", vds],
              ["Serial", vis],
              ["Origin", country],
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
  );
}

function titleFor(v: { year?: string | null; manufacturer?: string | null; model?: string | null }) {
  return [v.year && v.year !== "Unknown" ? v.year : null, v.manufacturer, v.model].filter(Boolean).join(" ") || "Unknown vehicle";
}

function DecodeResult({ vin, data, loggedInNotPremium }: { vin: string; data: FreeDecodeView; loggedInNotPremium: boolean }) {
  const v = data.vehicle;
  const specSections = Object.entries(data.specs);
  // A logged-in non-premium user goes to checkout (/account); an anonymous visitor
  // must sign in first, then return here.
  const unlockHref = loggedInNotPremium ? "/account" : `/login?next=/decode/${vin}`;

  return (
    <>
      <VehicleIdentityCard vin={vin} title={titleFor(v)} image_url={v.image_url} badge="Free decode" wmi={v.wmi} vds={v.vds} vis={v.vis} country={v.country} />

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
            <Link href={unlockHref} className="btn-brand shrink-0">
              {loggedInNotPremium ? "Unlock with premium" : "Sign in to unlock"}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function PremiumDecodeResult({ vin, data }: { vin: string; data: PremiumDecodeView }) {
  const v = data.vehicle;
  const specSections = Object.entries(data.specs).filter(([, fields]) => fields && typeof fields === "object");

  return (
    <>
      <VehicleIdentityCard vin={vin} title={titleFor(v)} image_url={v.image_url} badge="Premium report" wmi={v.wmi} vds={v.vds} vis={v.vis} country={v.country} />

      {/* Full specs */}
      {specSections.length > 0 && (
        <section className="mt-8">
          <h2 className="text-title text-fg">Specifications</h2>
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

      {/* Full history */}
      <section className="mt-8">
        <h2 className="text-title text-fg">Vehicle history</h2>
        {data.history.length === 0 ? (
          <p className="mt-3 text-body text-fg-muted">No history records on file yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {data.history.map((raw, i) => {
              const ev = raw as { id?: string; eventType?: string; occurredAt?: string | null; sourceType?: string | null; payload?: unknown };
              const when = ev.occurredAt ? new Date(ev.occurredAt).toLocaleDateString() : "—";
              return (
                <div key={ev.id ?? i} className="card flex items-start justify-between gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <FileClock className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-body font-semibold text-fg">{humanize(ev.eventType ?? "event")}</p>
                      {ev.sourceType && <p className="text-caption text-fg-muted">{humanize(ev.sourceType)}</p>}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-caption text-fg-muted">{when}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
