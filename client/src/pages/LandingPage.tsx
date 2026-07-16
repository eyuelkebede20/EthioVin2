import { Link } from "react-router-dom";
import { ScanLine, Database, ShieldCheck, RefreshCw, Building2, Stethoscope, Code2, ArrowRight } from "lucide-react";

// Public marketing/landing page — the first thing a signed-out visitor sees at "/".
// Explains what EthioVin is and routes to /login, instead of dumping people on a
// bare sign-in form. Signed-in users are redirected past this by App.tsx.
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2 font-bold text-xl tracking-wider text-slate-900">
          <div className="w-9 h-9 bg-orange-600 text-white rounded flex items-center justify-center font-mono">EV</div>
          EthioVin
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://ethiovinapi.senaycreatives.com/developers"
            className="hidden sm:inline text-sm font-semibold text-slate-600 hover:text-orange-600"
          >
            Developer API
          </a>
          <Link to="/login" className="rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-amber-600">
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-14 text-center">
        <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700">
          Built for the Ethiopian import fleet
        </span>
        <h1 className="mt-6 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
          Decode any imported car from its VIN — and get smarter with every scan.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          EthioVin reads the make, model, year and origin straight from a 17-character VIN. When a vehicle&apos;s specs are
          already known to the network, they come back instantly. When they aren&apos;t, a verified spec is added once — so
          the next car of that model decodes for everyone, automatically.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 font-bold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-amber-600">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="https://ethiovinapi.senaycreatives.com/developers"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-6 py-3 font-bold text-slate-700 hover:border-orange-400 hover:text-orange-600"
          >
            <Code2 className="h-4 w-4" /> For developers
          </a>
        </div>
      </section>

      {/* What it does */}
      <section className="border-t border-slate-100 bg-orange-50/40 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-slate-900">What EthioVin does</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { icon: ScanLine, t: "Decode from the VIN", d: "Make, model, year, plant and country of origin — parsed on the server from the WMI/VDS, tuned for the pre-2010 imports most decoders get wrong." },
              { icon: Database, t: "Instant cached specs", d: "The moment a model has been verified once, every future VIN of that same model returns full hardware specs immediately — no waiting, no re-work." },
              { icon: RefreshCw, t: "Self-improving network", d: "Unknown vehicles get verified once (AI-drafted specs + image search, confirmed by a person) and cached as shared knowledge for everyone." },
            ].map((f) => (
              <div key={f.t} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{f.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-slate-900">Who it&apos;s for</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { icon: Stethoscope, t: "Garages & diagnosticians", d: "Identify a car and pull its specs in seconds before a job — and contribute verified data back to the network." },
              { icon: Building2, t: "Insurers & assessors", d: "Confirm a vehicle&apos;s identity and specifications quickly during intake and claims." },
              { icon: Code2, t: "Developers", d: "A prepaid, credit-metered REST API (POST /v1/decode) with keys, usage and billing — build EthioVin into your own product." },
            ].map((f) => (
              <div key={f.t} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-orange-400">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{f.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-100 bg-slate-900 px-6 py-16 text-center text-white">
        <ShieldCheck className="mx-auto h-10 w-10 text-orange-400" />
        <h2 className="mt-4 text-2xl font-bold">Ready to decode your first VIN?</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-300">
          Create an account or sign in to start scanning. Verified data you add makes the whole network smarter.
        </p>
        <Link to="/login" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 font-bold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-amber-600">
          Sign in or create an account <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="px-6 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} EthioVin — VIN decoder for cars imported to Ethiopia.
      </footer>
    </div>
  );
}
