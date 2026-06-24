// Placeholder home — validates the design-system tokens render. The real landing
// page + live public decoder land in the next build step (iter B).
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
      <span className="inline-block rounded-full bg-brand-100 px-3 py-1 text-caption font-bold uppercase tracking-wide text-brand-700">EthioVin</span>
      <h1 className="mt-6 text-display text-fg">VIN intelligence for Ethiopia</h1>
      <p className="mt-4 text-lead text-fg-muted">Decode any imported vehicle. Free basics for everyone; premium unlocks the full history. The full landing and live decoder arrive in the next build step.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button className="btn-brand">Decode a VIN</button>
        <button className="btn-ghost">Learn more</button>
      </div>
      <div className="mt-12 card w-full max-w-md p-6 text-left">
        <p className="text-caption font-bold uppercase tracking-wide text-fg-muted">Design system</p>
        <div className="mt-3 flex gap-2">
          {["bg-brand-300", "bg-brand-500", "bg-brand-700", "bg-accent-500", "bg-success", "bg-error"].map((c) => (
            <span key={c} className={`h-8 w-8 rounded ${c}`} />
          ))}
        </div>
      </div>
    </main>
  );
}
