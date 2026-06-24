import Link from "next/link";
import { ScanLine, History, ShieldCheck, Wrench, Building2, Stethoscope, Check } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import VinSearch from "@/components/VinSearch";

export default function Home() {
  return (
    <>
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-gradient-to-b from-brand-100 to-transparent" />
        <div className="relative mx-auto max-w-3xl px-6 pb-12 pt-16 text-center sm:pt-24">
          <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-caption font-bold uppercase tracking-wide text-brand-700">
            VIN intelligence for Ethiopia
          </span>
          <h1 className="mt-6 text-display text-fg sm:text-hero">Know any imported car before you trust it.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lead text-fg-muted">
            Decode any vehicle&apos;s VIN for free — make, model and year in seconds. Go premium to unlock its full
            history: garage repairs, inspections, odometer records, insurance and police signals — pieced together by a
            self-improving network of garages, insurers and diagnosticians.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <VinSearch autoFocus />
          </div>
          <p className="mt-3 text-caption text-fg-muted">Free basics for everyone. No account needed to decode.</p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-title text-fg">How it works</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            { icon: ScanLine, title: "Decode", body: "Enter a 17-character VIN. We decode the make, model, year and origin instantly — free." },
            { icon: History, title: "See its history", body: "Premium reveals every recorded event: repairs, maintenance, odometer readings, inspections, claims." },
            { icon: ShieldCheck, title: "Trust the data", body: "Every contributor is trust-scored. Conflicting entries get flagged and resolved by corroboration." },
          ].map((s) => (
            <div key={s.title} className="card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                <s.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-lead font-bold text-fg">{s.title}</h3>
              <p className="mt-2 text-body text-fg-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The network */}
      <section className="bg-surface-2 py-16">
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
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-500/15 text-accent-600">
                  <s.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lead font-bold text-fg">{s.title}</h3>
                <p className="mt-2 text-body text-fg-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / tiers */}
      <section id="pricing" className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-center text-title text-fg">Free to decode. Premium to know everything.</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="card p-7">
            <h3 className="text-lead font-bold text-fg">Free</h3>
            <p className="mt-1 text-body text-fg-muted">For every buyer doing their homework.</p>
            <ul className="mt-5 space-y-3 text-body text-fg">
              {["Make, model & year", "Decoded WMI / VDS + origin", "Basic specs (fuel, transmission, body)", "See how many history records exist"].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <VinSearch />
            </div>
          </div>
          <div className="card border-brand-300 p-7 shadow-brand">
            <h3 className="text-lead font-bold text-brand-700">Premium</h3>
            <p className="mt-1 text-body text-fg-muted">The full story before you buy or insure.</p>
            <ul className="mt-5 space-y-3 text-body text-fg">
              {["Full hardware specifications", "Complete service & repair history", "Odometer trail with rollback flags", "Inspection results & vehicle health grade", "Insurance & police incident signals"].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/login" className="btn-brand mt-7 w-full">
              Get premium
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <p className="text-center text-caption text-fg-muted">© EthioVin — VIN intelligence for Ethiopia.</p>
      </footer>
    </>
  );
}
