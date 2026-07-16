import { Link } from "react-router-dom";
import { ScanLine, Database, RefreshCw, ShieldCheck, Building2, Stethoscope, Code2, ArrowRight, Check, Terminal } from "lucide-react";
import { IMPORT_COUNTRIES } from "../lib/constants";

// Public marketing/landing page — the first thing a signed-out visitor sees at "/".
// Explains what EthioVin is (a VIN decoder built for Ethiopia's imported-car fleet),
// walks through the process, and routes to /login. Signed-in users are redirected
// past this by App.tsx. The developer portal (keys/usage/billing) lives in the
// Next.js web/ app; here we describe the API and link out — see notes.md.
const DEV_PORTAL_URL = "https://ethiovinapi.senaycreatives.com/developers";

const COMMON_MAKES = ["Toyota", "Hyundai", "Suzuki", "Nissan", "BYD", "Isuzu", "Mitsubishi", "Kia"];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/90 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-2 text-xl font-bold tracking-wider text-slate-900">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-orange-600 font-mono text-white">EV</div>
          EthioVin
        </div>
        <div className="flex items-center gap-4">
          <a href="#how" className="hidden text-sm font-semibold text-slate-600 hover:text-orange-600 sm:inline">How it works</a>
          <a href="#developers" className="hidden text-sm font-semibold text-slate-600 hover:text-orange-600 sm:inline">Developers</a>
          <Link to="/login" className="rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-amber-600">
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="overflow-hidden bg-gradient-to-b from-orange-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700">
              🇪🇹 Made for Ethiopia&apos;s imported cars
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
              Know exactly what car you&apos;re looking at — straight from the VIN.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              Most vehicles on Ethiopian roads are imported from Japan, the UAE, China and beyond — often years before
              global databases cover them. EthioVin decodes the make, model, year and origin from the 17-character VIN,
              and remembers every model it learns so the whole country decodes faster over time.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 font-bold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-amber-600">
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#developers" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-6 py-3 font-bold text-slate-700 hover:border-orange-400 hover:text-orange-600">
                <Code2 className="h-4 w-4" /> For developers
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-green-600" /> Tuned for pre-2010 imports</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-green-600" /> Specs cached &amp; reused</span>
            </div>
          </div>

          {/* Hero car illustration */}
          <div className="relative">
            <CarHero />
          </div>
        </div>

        {/* Import origins strip */}
        <div className="border-t border-orange-100 bg-white/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-4 text-sm font-semibold text-slate-500">
            <span className="text-slate-400">Decodes imports from</span>
            {IMPORT_COUNTRIES.map((c) => (
              <span key={c.code} className="inline-flex items-center gap-1.5">
                <span className="text-lg">{c.flag}</span> {c.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — the process, clearly */}
      <section id="how" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold text-slate-900">How it works</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
            Four steps from a VIN to a full, shareable vehicle profile — and every unknown car makes the next lookup smarter.
          </p>
          <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              { n: 1, icon: ScanLine, t: "Enter the VIN", d: "Type or paste the 17-character VIN. We parse the WMI/VDS on the server and decode the model year correctly — even for older imports." },
              { n: 2, icon: Database, t: "Instant match", d: "If this model has been verified before, its full hardware specs come back immediately. No waiting, no guessing." },
              { n: 3, icon: RefreshCw, t: "New car? Verify once", d: "Never-seen model? An AI-drafted spec sheet plus image search is confirmed by a person — one time." },
              { n: 4, icon: ShieldCheck, t: "Cached for everyone", d: "That verified model is saved to the shared network, so the next identical car anywhere decodes instantly." },
            ].map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-sm font-bold text-white shadow">
                  {s.n}
                </div>
                <s.icon className="mt-3 h-7 w-7 text-orange-500" />
                <h3 className="mt-4 text-lg font-bold text-slate-900">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you get + a visual */}
      <section className="border-y border-slate-100 bg-orange-50/40 px-6 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">A complete picture, in seconds</h2>
            <p className="mt-4 text-slate-600">
              EthioVin isn&apos;t a generic global decoder — it&apos;s built around the makes that actually fill Ethiopian
              lots: {COMMON_MAKES.join(", ")} and more. For every VIN you get:
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Vehicle identity — make, model and model year decoded from the VIN itself.",
                "Origin & maker — the WMI/VDS tell you who built it and where.",
                "Full hardware specs — engine, transmission, dimensions, tyres and more, once a model is verified.",
                "A shareable profile you can pull up again by VIN.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-slate-700">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-green-600" /> <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
            <CarProfileCard />
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold text-slate-900">Who it&apos;s for</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { icon: Stethoscope, t: "Garages & diagnosticians", d: "Identify a car and pull its specs before a job — and contribute verified data back to the network." },
              { icon: Building2, t: "Insurers & assessors", d: "Confirm a vehicle's identity and specifications quickly during intake and claims." },
              { icon: Code2, t: "Developers", d: "A prepaid, credit-metered REST API to build EthioVin's decoder into your own product." },
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

      {/* For developers */}
      <section id="developers" className="border-t border-slate-100 bg-slate-900 px-6 py-20 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-300">
              <Terminal className="h-3.5 w-3.5" /> Developer API
            </span>
            <h2 className="mt-5 text-3xl font-bold">Decode VINs from your own app</h2>
            <p className="mt-4 text-slate-300">
              One REST call returns the decoded vehicle. Pay only for decodes that return data with prepaid credits —
              parse-only misses and invalid VINs are free. Get an API key, top up in Birr, and go.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" /> <code className="rounded bg-white/10 px-1.5 py-0.5">POST /v1/decode</code> — one VIN, one JSON response</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" /> Credit metering, per-key rate limits, usage dashboard</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" /> Top up with Chapa (ETB) or a promo code</li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={DEV_PORTAL_URL} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 font-bold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-amber-600">
                Open the developer portal <ArrowRight className="h-4 w-4" />
              </a>
              <a href={`${DEV_PORTAL_URL}/docs`} className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-6 py-3 font-bold text-white hover:border-orange-400 hover:text-orange-300">
                Read the docs
              </a>
            </div>
          </div>

          {/* Code sample */}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/80" />
              <span className="h-3 w-3 rounded-full bg-green-400/80" />
              <span className="ml-2 text-xs text-slate-400">decode.sh</span>
            </div>
            <pre className="overflow-x-auto p-5 text-sm leading-relaxed text-slate-200">
              <code>{`curl -X POST \\
  https://ethiovinapi.senaycreatives.com/v1/decode \\
  -H "Authorization: Bearer evn_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"vin": "JTDBR32E..."}'

# → { "vehicle": { "make": "Toyota", ... },
#     "specs": { ... },
#     "credits": { "charged": 1, "balance": 249 } }`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-orange-500" />
        <h2 className="mt-4 text-3xl font-bold text-slate-900">Ready to decode your first VIN?</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          Create an account or sign in to start scanning. Every verified car you add makes the whole network smarter.
        </p>
        <Link to="/login" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-7 py-3 font-bold text-white shadow-lg shadow-orange-500/30 hover:from-orange-600 hover:to-amber-600">
          Sign in or create an account <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="border-t border-slate-100 px-6 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} EthioVin — VIN decoder for cars imported to Ethiopia.
      </footer>
    </div>
  );
}

/** Stylised hero car with a VIN-scan overlay — inline SVG, no external assets. */
function CarHero() {
  return (
    <svg viewBox="0 0 480 300" className="mx-auto w-full max-w-lg drop-shadow-xl" role="img" aria-label="Illustration of a car being decoded from its VIN">
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fb923c" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#bae6fd" />
        </linearGradient>
      </defs>
      {/* road */}
      <ellipse cx="240" cy="248" rx="210" ry="20" fill="#f1f5f9" />
      {/* body */}
      <path d="M70 200 L100 150 Q112 128 150 122 L300 118 Q340 118 366 150 L410 178 Q430 184 430 202 L430 214 Q430 224 418 224 L82 224 Q68 224 68 210 Z" fill="url(#body)" />
      {/* cabin glass */}
      <path d="M150 138 Q120 142 112 162 L108 176 L214 176 L214 134 Z" fill="url(#glass)" />
      <path d="M226 134 L226 176 L356 176 L338 152 Q322 136 296 134 Z" fill="url(#glass)" />
      {/* door line */}
      <line x1="220" y1="134" x2="220" y2="216" stroke="#c2410c" strokeWidth="3" />
      {/* wheels */}
      <circle cx="150" cy="224" r="34" fill="#1e293b" />
      <circle cx="150" cy="224" r="15" fill="#94a3b8" />
      <circle cx="340" cy="224" r="34" fill="#1e293b" />
      <circle cx="340" cy="224" r="15" fill="#94a3b8" />
      {/* headlight */}
      <path d="M410 184 L428 190 L428 200 L410 198 Z" fill="#fde68a" />
      {/* VIN scan panel */}
      <g>
        <rect x="150" y="250" width="220" height="34" rx="8" fill="#0f172a" />
        <text x="164" y="272" fontFamily="monospace" fontSize="16" letterSpacing="2" fill="#fdba74">JTDBR32E•••••••</text>
        <rect x="150" y="250" width="6" height="34" rx="3" fill="#f97316">
          <animate attributeName="x" values="150;364;150" dur="2.4s" repeatCount="indefinite" />
        </rect>
      </g>
    </svg>
  );
}

/** A miniature decoded-vehicle profile card — inline SVG-free, pure markup. */
function CarProfileCard() {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 text-2xl">🚗</div>
        <div>
          <div className="font-mono text-xs text-slate-400">VIN JTDBR32E•••••••</div>
          <div className="text-lg font-bold text-slate-900">Toyota Corolla · 2016</div>
        </div>
        <span className="ml-auto rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">Verified</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        {[
          ["Origin", "🇯🇵 Japan"],
          ["Engine", "1.8L Petrol"],
          ["Transmission", "CVT Automatic"],
          ["Body", "Sedan"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-400">{k}</div>
            <div className="font-semibold text-slate-800">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-dashed border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
        Cached from the network — this model was verified once and now decodes instantly.
      </div>
    </div>
  );
}
