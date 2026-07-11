"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Terminal, Zap, ShieldCheck, Globe, Wallet, ArrowRight, Check } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { demoApi, devApi, ApiError, type DemoDecode, type CreditPackRow } from "@/lib/api";

export default function DevelopersLanding() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <LiveDemo />
        <HowItWorks />
        <WhyNotGlobal />
        <Pricing />
        <CodeSamples />
        <UseCases />
        <Faq />
        <Footer />
      </main>
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-brand-50 to-transparent">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-caption font-bold text-brand-700">
          <Terminal className="h-3.5 w-3.5" /> EthioVin API · v1
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-hero font-bold text-fg">
          Decode any VIN imported to Ethiopia — make, model, year, verified specs — in one API call.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lead text-fg-muted">
          Built for the actual Ethiopian car park: ASEAN-market VINs, correct model-year decoding for the
          pre-2010 import fleet, and human-verified specs that improve as the network grows.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login?next=/dashboard/api" className="btn-brand">
            Get a free API key <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/developers/docs" className="btn-ghost">Read the docs</Link>
        </div>
      </div>
    </section>
  );
}

function LiveDemo() {
  const [vins, setVins] = useState<string[]>([]);
  const [vin, setVin] = useState("");
  const [result, setResult] = useState<DemoDecode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    demoApi
      .vins()
      .then((r) => {
        setVins(r.vins);
        if (r.vins[0]) setVin(r.vins[0]);
      })
      .catch(() => undefined);
  }, []);

  const run = async () => {
    if (!vin) return;
    setLoading(true);
    setError("");
    try {
      setResult(await demoApi.decode(vin));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Demo failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-display text-fg">Try it live</h2>
      <p className="mt-1 text-body text-fg-muted">Pick a sample VIN and see the exact JSON the API returns. No key needed.</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <label className="text-caption font-bold uppercase tracking-wide text-fg-muted">Sample VIN</label>
          <select value={vin} onChange={(e) => setVin(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-bg px-4 py-2.5 font-mono text-body text-fg outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
            {vins.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <button onClick={run} disabled={loading || !vin} className="btn-brand mt-4 w-full justify-center">
            <Zap className="h-4 w-4" /> {loading ? "Decoding…" : "Decode"}
          </button>
          {error && <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{error}</p>}
        </div>
        <div className="card overflow-hidden bg-fg p-0">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
            <span className="h-3 w-3 rounded-full bg-error/70" />
            <span className="h-3 w-3 rounded-full bg-warning/70" />
            <span className="h-3 w-3 rounded-full bg-success/70" />
            <span className="ml-2 font-mono text-caption text-white/50">POST /v1/decode</span>
          </div>
          <pre className="max-h-96 overflow-auto p-4 font-mono text-caption leading-relaxed text-white/90">
            {result ? JSON.stringify(result, null, 2) : "// Choose a VIN and press Decode"}
          </pre>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "1", t: "Send a VIN", d: "POST the 17-character VIN with your API key." },
    { n: "2", t: "We match it", d: "Against the verified Ethiopian import database — server-derived, I/O/Q preserved." },
    { n: "3", t: "Get specs JSON", d: "Make, model, year, and full verified hardware specs. 1 credit per hit." },
  ];
  return (
    <section className="border-y border-border bg-surface-2/40">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-display text-fg">How it works</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-lead font-bold text-white shadow-brand">{s.n}</span>
              <h3 className="mt-4 text-lead font-bold text-fg">{s.t}</h3>
              <p className="mt-1 text-body text-fg-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyNotGlobal() {
  const points = [
    { icon: Globe, t: "ASEAN-market VINs", d: "Handles VINs containing I/O/Q that global decoders reject or mis-shift." },
    { icon: Zap, t: "Correct model year", d: "Position-7 cycle logic decodes the pre-2010 import fleet correctly." },
    { icon: ShieldCheck, t: "Human-verified specs", d: "Verified by the contributor network — not scraped guesses." },
    { icon: Wallet, t: "Pay in ETB", d: "Top up with telebirr / CBE Birr / cards via Chapa." },
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-display text-fg">Why not a global decoder?</h2>
      <p className="mt-1 max-w-2xl text-body text-fg-muted">Global VIN databases are built for the US/EU market. EthioVin is built for the cars actually on Ethiopian roads.</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {points.map((p) => (
          <div key={p.t} className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
              <p.icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lead font-bold text-fg">{p.t}</h3>
              <p className="mt-1 text-body text-fg-muted">{p.d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const [packs, setPacks] = useState<CreditPackRow[]>([]);
  useEffect(() => {
    devApi.packs().then((r) => setPacks(r.packs)).catch(() => undefined);
  }, []);
  return (
    <section className="border-y border-border bg-surface-2/40">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-display text-fg">Simple, prepaid pricing</h2>
        <p className="mt-1 text-body text-fg-muted">1 credit = one decode that returns data. Parse-only misses and invalid VINs are free. New accounts get free credits to start.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {packs.map((p) => (
            <div key={p.pack_id} className="card flex flex-col p-6">
              <p className="text-caption uppercase tracking-wide text-fg-muted">{p.pack_id}</p>
              <p className="mt-1 text-display font-bold text-fg">{p.credits.toLocaleString()}</p>
              <p className="text-body text-fg-muted">credits · {p.note}</p>
              <p className="mt-4 text-lead font-bold text-brand-600">{p.price_etb.toLocaleString()} ETB</p>
            </div>
          ))}
        </div>
        <Link href="/login?next=/dashboard/api" className="btn-brand mt-8 inline-flex">Start free <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </section>
  );
}

const SAMPLES: Record<string, string> = {
  curl: `curl -X POST https://api.ethiovin.com/v1/decode \\
  -H "Authorization: Bearer $ETHIOVIN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"vin": "LCO..............."}'`,
  Node: `const res = await fetch("https://api.ethiovin.com/v1/decode", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.ETHIOVIN_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ vin }),
});
const data = await res.json();
console.log(data.match, data.vehicle, data.credits.balance);`,
  Python: `import os, requests

r = requests.post(
    "https://api.ethiovin.com/v1/decode",
    headers={"Authorization": f"Bearer {os.environ['ETHIOVIN_API_KEY']}"},
    json={"vin": vin}, timeout=15,
)
data = r.json()
print(data["match"], data["vehicle"], data["credits"]["balance"])`,
};

function CodeSamples() {
  const [lang, setLang] = useState<keyof typeof SAMPLES>("curl");
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-display text-fg">Integrate in minutes</h2>
      <div className="mt-6 card overflow-hidden bg-fg p-0">
        <div className="flex gap-1 border-b border-white/10 px-3 pt-3">
          {Object.keys(SAMPLES).map((l) => (
            <button key={l} onClick={() => setLang(l as keyof typeof SAMPLES)} className={`rounded-t-lg px-4 py-2 text-caption font-semibold transition ${lang === l ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"}`}>
              {l}
            </button>
          ))}
        </div>
        <pre className="overflow-auto p-5 font-mono text-caption leading-relaxed text-white/90">{SAMPLES[lang]}</pre>
      </div>
    </section>
  );
}

function UseCases() {
  const cases = ["Insurance underwriting", "Bank auto-loan collateral checks", "Marketplaces & listings", "Customs & import brokers", "Fleet onboarding", "Dealership inventory"];
  return (
    <section className="border-y border-border bg-surface-2/40">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-display text-fg">Built for</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <div key={c} className="flex items-center gap-3 rounded-lg border border-border bg-bg px-4 py-3">
              <Check className="h-4 w-4 shrink-0 text-brand-600" />
              <span className="text-body text-fg">{c}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    { q: "What counts as a billable decode?", a: "Only a decode that returns vehicle data (match “exact” or “model”) costs 1 credit. Parse-only misses and invalid VINs are free." },
    { q: "How accurate is the model year?", a: "It’s decoded from the VIN (position 10, with the position-7 cycle rule for pre-2010 cars) — a strong heuristic, not a registration record." },
    { q: "Can I use the key in a browser or mobile app?", a: "No — keys are server-side secrets. Anyone holding a key can spend your credits. Cross-origin browser use is unsupported by design." },
    { q: "How do I pay?", a: "Top up credits in ETB via Chapa (telebirr, CBE Birr, cards), or redeem a promo code in your dashboard." },
  ];
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h2 className="text-display text-fg">FAQ</h2>
      <div className="mt-6 space-y-4">
        {faqs.map((f) => (
          <div key={f.q} className="card p-5">
            <h3 className="text-lead font-bold text-fg">{f.q}</h3>
            <p className="mt-1 text-body text-fg-muted">{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
        <p className="text-body text-fg-muted">EthioVin API · Decode Ethiopia’s imported cars.</p>
        <div className="flex gap-4 text-body">
          <Link href="/developers/docs" className="text-brand-600 hover:underline">Docs</Link>
          <Link href="/dashboard/api" className="text-brand-600 hover:underline">Dashboard</Link>
        </div>
      </div>
    </footer>
  );
}
