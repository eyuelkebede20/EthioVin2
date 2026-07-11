import Link from "next/link";
import {
  ScanLine,
  History,
  ShieldCheck,
  Wrench,
  Building2,
  Stethoscope,
  Check,
  Gauge,
  FileClock,
  MapPin,
  Fingerprint,
  Globe,
  BadgeCheck,
  Star,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import VinSearch from "@/components/VinSearch";

export default function Home() {
  return (
    <>
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-24 h-80 bg-gradient-to-b from-brand-100 to-transparent" />
        <div className="relative mx-auto max-w-3xl px-6 pb-12 pt-16 text-center sm:pt-24">
          <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-caption font-bold uppercase tracking-wide text-brand-700">
            Vehicle history reports for Ethiopia
          </span>
          <h1 className="mt-6 text-display text-fg sm:text-hero">Every imported car has a past. Read it before you buy.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lead text-fg-muted">
            Enter a VIN to decode any vehicle for free — make, model and year in seconds. Unlock the full report for its
            complete history: service records, odometer trail, inspections, insurance and police signals.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <VinSearch autoFocus />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-caption text-fg-muted">
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Free decode, no account</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Built for the Ethiopian import fleet</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Human-verified data</span>
          </div>
        </div>
      </section>

      {/* What's in a report */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-title text-fg">What&apos;s in a report</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-body text-fg-muted">
          Free covers the basics every buyer should check. Premium opens the complete record.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Fingerprint, t: "Vehicle identity", d: "Make, model, year and origin decoded straight from the VIN.", tier: "Free" },
            { icon: MapPin, t: "Origin & maker", d: "Decoded WMI / VDS — who built it and where.", tier: "Free" },
            { icon: Gauge, t: "Core specs", d: "Fuel, transmission, body style and class.", tier: "Free" },
            { icon: Wrench, t: "Full specifications", d: "Every engine, drivetrain, dimension and chassis figure.", tier: "Premium" },
            { icon: FileClock, t: "Service & repair history", d: "Repairs, maintenance and inspections recorded by the network.", tier: "Premium" },
            { icon: History, t: "Odometer trail", d: "Mileage over time, with rollback flags.", tier: "Premium" },
            { icon: ShieldCheck, t: "Health grade", d: "A single grade summarizing the vehicle's condition.", tier: "Premium" },
            { icon: Building2, t: "Insurance & police signals", d: "Minimized incident signals from insurers and reports.", tier: "Premium" },
            { icon: BadgeCheck, t: "Verified by contributors", d: "Every fact is trust-scored; conflicts are flagged and resolved.", tier: "Premium" },
          ].map((s) => (
            <div key={s.t} className="card p-5">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600"><s.icon className="h-5 w-5" /></span>
                <span className={`rounded-full px-2 py-0.5 text-caption font-bold ${s.tier === "Free" ? "bg-success/15 text-success" : "bg-brand-100 text-brand-700"}`}>{s.tier}</span>
              </div>
              <h3 className="mt-4 text-lead font-bold text-fg">{s.t}</h3>
              <p className="mt-1 text-body text-fg-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-surface-2/50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-title text-fg">How it works</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { icon: ScanLine, title: "Enter a VIN", body: "Type or paste the 17-character VIN. We decode make, model, year and origin instantly — free." },
              { icon: FileClock, title: "Open the report", body: "See the basics free; unlock premium for the full specifications and complete history." },
              { icon: ShieldCheck, title: "Buy with confidence", body: "Spot rollbacks, hidden damage and mismatched identities before money changes hands." },
            ].map((s, i) => (
              <div key={s.title} className="card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-lead font-bold text-white shadow-brand">{i + 1}</span>
                  <s.icon className="h-5 w-5 text-brand-600" />
                </div>
                <h3 className="mt-4 text-lead font-bold text-fg">{s.title}</h3>
                <p className="mt-2 text-body text-fg-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample report preview */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-title text-fg">A report that reads at a glance</h2>
            <p className="mt-3 text-body text-fg-muted">
              Identity up top, a summary strip of the facts that matter, decoded maker codes, sectioned specifications,
              and a clear history timeline. No jargon dumps — just what you need to make the call.
            </p>
            <ul className="mt-5 space-y-3 text-body text-fg">
              {["Verified identity & origin", "Sectioned, readable specifications", "Chronological history timeline", "Health grade & incident signals"].map((f) => (
                <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" /> {f}</li>
              ))}
            </ul>
          </div>
          <SampleReport />
        </div>
      </section>

      {/* The network */}
      <section className="bg-surface-2/50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-title text-fg">Built by the people who know these cars</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-body text-fg-muted">
            Garages, insurers and diagnostic centers contribute the data — and earn for it. The more they add, the
            sharper every report becomes.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { icon: Wrench, title: "Garages", body: "Run daily jobs, parts and invoices in-app. Each completed job feeds the vehicle's service history." },
              { icon: Building2, title: "Insurers", body: "Share minimized claim signals; in return, pull decoded identity and a vehicle health grade." },
              { icon: Stethoscope, title: "Diagnosticians", body: "Log inspections and odometer readings that flag rollbacks and build a trustworthy record." },
            ].map((s) => (
              <div key={s.title} className="card p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-500/15 text-accent-600"><s.icon className="h-6 w-6" /></span>
                <h3 className="mt-4 text-lead font-bold text-fg">{s.title}</h3>
                <p className="mt-2 text-body text-fg-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why local */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-title text-fg">Made for Ethiopia&apos;s cars — not a generic decoder</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Globe, t: "ASEAN-market VINs", d: "Handles VINs containing I / O / Q that global decoders reject or mis-read." },
            { icon: History, t: "Correct model year", d: "Position-7 cycle logic decodes the pre-2010 import fleet accurately." },
            { icon: BadgeCheck, t: "Human-verified", d: "Specs are verified by the network, not scraped guesses." },
            { icon: MapPin, t: "The real car park", d: "Coverage grows around the cars actually imported to Ethiopia." },
          ].map((s) => (
            <div key={s.t} className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600"><s.icon className="h-5 w-5" /></span>
              <div>
                <h3 className="text-lead font-bold text-fg">{s.t}</h3>
                <p className="mt-1 text-body text-fg-muted">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section id="pricing" className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-center text-title text-fg">Free to decode. Premium to know everything.</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="card p-7">
            <h3 className="text-lead font-bold text-fg">Free</h3>
            <p className="mt-1 text-body text-fg-muted">For every buyer doing their homework.</p>
            <ul className="mt-5 space-y-3 text-body text-fg">
              {["Make, model & year", "Decoded WMI / VDS + origin", "Basic specs (fuel, transmission, body)", "See how many history records exist"].map((f) => (
                <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-5 w-5 shrink-0 text-success" /> {f}</li>
              ))}
            </ul>
            <div className="mt-7"><VinSearch /></div>
          </div>
          <div className="card relative overflow-hidden border-brand-300 p-7 shadow-brand">
            <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-0.5 text-caption font-bold text-white"><Star className="h-3.5 w-3.5" /> Full report</span>
            <h3 className="text-lead font-bold text-brand-700">Premium</h3>
            <p className="mt-1 text-body text-fg-muted">The full story before you buy or insure.</p>
            <ul className="mt-5 space-y-3 text-body text-fg">
              {["Full hardware specifications", "Complete service & repair history", "Odometer trail with rollback flags", "Inspection results & vehicle health grade", "Insurance & police incident signals"].map((f) => (
                <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" /> {f}</li>
              ))}
            </ul>
            <Link href="/login" className="btn-brand mt-7 w-full">Get premium</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-center text-title text-fg">Common questions</h2>
        <div className="mt-8 space-y-4">
          {[
            { q: "Is the free decode really free?", a: "Yes — decode any VIN's make, model, year, origin and basic specs with no account and no charge." },
            { q: "Where does the history come from?", a: "From a network of garages, insurers and diagnostic centers who record real events. Every contributor is trust-scored and conflicting entries are resolved by corroboration." },
            { q: "What if a car has no history yet?", a: "You still get the full decoded identity and specifications. Coverage is self-improving — records appear as the network logs events for that vehicle." },
            { q: "Do you support Chinese and ASEAN-market cars?", a: "Yes. We correctly handle VINs with I/O/Q and the model-year quirks common to imported vehicles that trip up generic decoders." },
          ].map((f) => (
            <div key={f.q} className="card p-5">
              <h3 className="text-lead font-bold text-fg">{f.q}</h3>
              <p className="mt-1 text-body text-fg-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <p className="text-body text-fg-muted">© EthioVin — Vehicle history reports for Ethiopia.</p>
          <div className="flex gap-5 text-body">
            <Link href="/#pricing" className="text-fg-muted hover:text-fg">Pricing</Link>
            <Link href="/developers" className="text-fg-muted hover:text-fg">Developers</Link>
            <Link href="/login" className="text-brand-600 hover:underline">Sign in</Link>
          </div>
        </div>
      </footer>
    </>
  );
}

// A static mock of the report layout — pure decoration for the landing page.
function SampleReport() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-surface-2/50 px-5 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white"><ScanLine className="h-5 w-5" /></span>
        <div>
          <p className="text-body font-bold text-fg">2024 Sample Model</p>
          <p className="font-mono text-caption text-fg-muted">VIN L••••••••••••••••</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-caption font-bold text-brand-700"><BadgeCheck className="h-3.5 w-3.5" /> Verified</span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-border">
        {[
          { l: "Origin", v: "China" },
          { l: "Year", v: "2024" },
          { l: "Records", v: "6" },
        ].map((s) => (
          <div key={s.l} className="bg-bg px-4 py-3 text-center">
            <p className="text-caption uppercase tracking-wide text-fg-muted">{s.l}</p>
            <p className="text-body font-bold text-fg">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2.5 p-5">
        {[
          { icon: Gauge, l: "Engine", v: "1.5L · Hybrid" },
          { icon: Wrench, l: "Transmission", v: "e-CVT · FWD" },
          { icon: FileClock, l: "Last service", v: "3,120 km ago" },
        ].map((r) => (
          <div key={r.l} className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><r.icon className="h-4 w-4" /></span>
            <span className="text-body text-fg-muted">{r.l}</span>
            <span className="ml-auto text-body font-semibold text-fg">{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
