import Link from "next/link";
import { cookies } from "next/headers";
import {
  Car,
  Lock,
  FileClock,
  Gauge,
  Cog,
  Ruler,
  Weight,
  CircleDot,
  Tag,
  Zap,
  ShieldCheck,
  Wrench,
  MapPin,
  CalendarDays,
  BadgeCheck,
  ChevronRight,
} from "lucide-react";
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

// Section → icon, keyed on the lower-cased section name (with a default).
const SECTION_ICONS: Record<string, typeof Gauge> = {
  engine: Gauge,
  transmission: Cog,
  dimensions: Ruler,
  weightandcapacity: Weight,
  tiresandchassis: CircleDot,
  classification: Tag,
  marketinformation: Tag,
  electricvehicle: Zap,
  electrical: Zap,
  safety: ShieldCheck,
};
const sectionIcon = (name: string) => SECTION_ICONS[name.toLowerCase().replace(/[^a-z]/g, "")] ?? Wrench;

function titleFor(v: { year?: string | null; manufacturer?: string | null; model?: string | null }) {
  return [v.year && v.year !== "Unknown" ? v.year : null, v.manufacturer, v.model].filter(Boolean).join(" ") || "Unknown vehicle";
}

export default async function DecodePage({ params }: { params: Promise<{ vin: string }> }) {
  const { vin } = await params;

  // Forward the visitor's cookies — a server-side fetch carries no browser cookie jar,
  // so without this the API can never see the session and every visitor looks anonymous.
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // Active premium entitlement -> full report; 402 -> logged-in-not-premium; else anonymous.
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
      <main className="mx-auto max-w-4xl px-6 py-8">
        {premium ? (
          <PremiumReport vin={vin} data={premium} />
        ) : !free ? (
          <div className="card p-10 text-center">
            <h1 className="text-title text-fg">Couldn&apos;t decode that VIN</h1>
            <p className="mt-2 text-body text-fg-muted">{error}</p>
            <Link href="/" className="btn-brand mt-6 inline-flex">Try another VIN</Link>
          </div>
        ) : (
          <FreeReport vin={vin} data={free} loggedInNotPremium={loggedInNotPremium} />
        )}
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Report header + summary
// ---------------------------------------------------------------------------
function ReportHeader({
  vin,
  title,
  image_url,
  tier,
  premium,
}: {
  vin: string;
  title: string;
  image_url?: string | null;
  tier: string;
  premium: boolean;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="relative grid sm:grid-cols-5">
        <div className="relative flex items-center justify-center bg-surface-2 sm:col-span-2 sm:min-h-[220px]">
          {image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image_url} alt={title} className="h-full max-h-56 w-full object-cover" />
          ) : (
            <div className="flex h-40 w-full flex-col items-center justify-center gap-2 text-fg-muted">
              <Car className="h-9 w-9" />
              <span className="text-caption">No image yet</span>
            </div>
          )}
        </div>
        <div className="p-6 sm:col-span-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-bold ${premium ? "bg-brand-500 text-white" : "bg-brand-100 text-brand-700"}`}>
              {premium ? <><BadgeCheck className="h-3.5 w-3.5" /> Premium report</> : tier}
            </span>
          </div>
          <h1 className="mt-2 text-display text-fg">{title}</h1>
          <p className="mt-1 font-mono text-body text-fg-muted">VIN {vin}</p>
        </div>
      </div>
    </div>
  );
}

function SummaryStrip({ items }: { items: { icon: typeof MapPin; label: string; value: string }[] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="card flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><it.icon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="text-caption uppercase tracking-wide text-fg-muted">{it.label}</p>
            <p className="truncate text-body font-bold text-fg">{it.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function decodedIds(v: { wmi?: string | null; vds?: string | null; vis?: string | null }) {
  return (
    <section className="mt-8">
      <h2 className="text-title text-fg">Decoded identity</h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {[
          ["WMI (maker)", v.wmi],
          ["VDS (model code)", v.vds],
          ["Serial", v.vis],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <dt className="text-caption uppercase tracking-wide text-fg-muted">{label}</dt>
            <dd className="mt-0.5 font-mono text-body text-fg">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SpecSection({ section, fields }: { section: string; fields: Record<string, unknown> }) {
  const Icon = sectionIcon(section);
  const entries = Object.entries(fields).filter(([, val]) => val !== null && val !== undefined && val !== "");
  if (entries.length === 0) return null;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border bg-surface-2/50 px-5 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600"><Icon className="h-4 w-4" /></span>
        <h3 className="text-body font-bold text-fg">{humanize(section)}</h3>
      </div>
      <dl className="divide-y divide-border">
        {entries.map(([k, val]) => (
          <div key={k} className="flex justify-between gap-4 px-5 py-2.5 text-body">
            <dt className="text-fg-muted">{humanize(k)}</dt>
            <dd className="text-right font-semibold text-fg">{String(val)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Free report (teaser + locked premium sections)
// ---------------------------------------------------------------------------
function FreeReport({ vin, data, loggedInNotPremium }: { vin: string; data: FreeDecodeView; loggedInNotPremium: boolean }) {
  const v = data.vehicle;
  const specSections = Object.entries(data.specs);
  const unlockHref = loggedInNotPremium ? "/account" : `/login?next=/decode/${vin}`;

  return (
    <>
      <ReportHeader vin={vin} title={titleFor(v)} image_url={v.image_url} tier="Free decode" premium={false} />
      <SummaryStrip
        items={[
          { icon: MapPin, label: "Origin", value: v.country || "—" },
          { icon: CalendarDays, label: "Model year", value: v.year && v.year !== "Unknown" ? v.year : "—" },
          { icon: FileClock, label: "History records", value: String(data.historyAvailable) },
          { icon: ShieldCheck, label: "Report tier", value: "Free" },
        ]}
      />

      {decodedIds(v)}

      {specSections.length > 0 && (
        <section className="mt-8">
          <h2 className="text-title text-fg">Basics</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {specSections.map(([section, fields]) => (
              <SpecSection key={section} section={section} fields={fields as Record<string, unknown>} />
            ))}
          </div>
        </section>
      )}

      {/* Locked premium sections — a report preview behind the paywall */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-title text-fg">Full report</h2>
          <Link href={unlockHref} className="btn-brand shrink-0">{loggedInNotPremium ? "Unlock with premium" : "Sign in to unlock"}</Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { icon: Wrench, t: "Full specifications", d: "Every engine, drivetrain, dimension and chassis figure." },
            { icon: FileClock, t: "Service & repair history", d: `${data.historyAvailable} record${data.historyAvailable === 1 ? "" : "s"} on file — repairs, maintenance, inspections.` },
            { icon: Gauge, t: "Odometer trail", d: "Mileage readings over time with rollback flags." },
            { icon: ShieldCheck, t: "Health grade & signals", d: "A vehicle health grade plus insurance and police incident signals." },
          ].map((s) => (
            <div key={s.t} className="card relative overflow-hidden p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-fg-muted"><s.icon className="h-5 w-5" /></span>
                <div>
                  <h3 className="flex items-center gap-1.5 text-lead font-bold text-fg"><Lock className="h-4 w-4 text-brand-500" /> {s.t}</h3>
                  <p className="mt-1 text-body text-fg-muted">{s.d}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 card relative overflow-hidden border-brand-200 p-7 text-center">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-50 to-transparent" />
        <div className="relative">
          <h2 className="text-title text-fg">See the complete history before you commit</h2>
          <p className="mx-auto mt-2 max-w-md text-body text-fg-muted">Unlock the full report — specifications, the complete service &amp; odometer history, inspections and a vehicle health grade.</p>
          <Link href={unlockHref} className="btn-brand mt-5 inline-flex">{loggedInNotPremium ? "Unlock with premium" : "Sign in to unlock"}</Link>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Premium report (full specs + history timeline)
// ---------------------------------------------------------------------------
function PremiumReport({ vin, data }: { vin: string; data: PremiumDecodeView }) {
  const v = data.vehicle;
  const specSections = Object.entries(data.specs).filter(([, fields]) => fields && typeof fields === "object");

  return (
    <>
      <ReportHeader vin={vin} title={titleFor(v)} image_url={v.image_url} tier="Premium report" premium />
      <SummaryStrip
        items={[
          { icon: MapPin, label: "Origin", value: v.country || "—" },
          { icon: CalendarDays, label: "Model year", value: v.year && v.year !== "Unknown" ? v.year : "—" },
          { icon: FileClock, label: "History records", value: String(data.history.length) },
          { icon: BadgeCheck, label: "Report tier", value: "Premium" },
        ]}
      />

      {decodedIds(v)}

      {specSections.length > 0 && (
        <section className="mt-8">
          <h2 className="text-title text-fg">Specifications</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {specSections.map(([section, fields]) => (
              <SpecSection key={section} section={section} fields={fields as Record<string, unknown>} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-title text-fg">Vehicle history</h2>
        {data.history.length === 0 ? (
          <p className="mt-3 card p-6 text-body text-fg-muted">No history records on file yet. As garages, insurers and diagnosticians record events for this vehicle, they&apos;ll appear here.</p>
        ) : (
          <ol className="mt-5 relative border-l-2 border-border pl-6">
            {data.history.map((raw, i) => {
              const ev = raw as { id?: string; eventType?: string; occurredAt?: string | null; sourceType?: string | null };
              const when = ev.occurredAt ? new Date(ev.occurredAt).toLocaleDateString() : "—";
              return (
                <li key={ev.id ?? i} className="relative mb-5 last:mb-0">
                  <span className="absolute -left-[1.95rem] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 ring-4 ring-bg"><FileClock className="h-3.5 w-3.5 text-brand-600" /></span>
                  <div className="card flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="text-body font-semibold text-fg">{humanize(ev.eventType ?? "event")}</p>
                      {ev.sourceType && <p className="text-caption text-fg-muted">{humanize(ev.sourceType)}</p>}
                    </div>
                    <span className="shrink-0 font-mono text-caption text-fg-muted">{when}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <Link href="/" className="mt-8 inline-flex items-center gap-1 text-body font-semibold text-brand-600 hover:underline">Decode another VIN <ChevronRight className="h-4 w-4" /></Link>
    </>
  );
}
