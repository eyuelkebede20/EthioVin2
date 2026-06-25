"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown, ScanLine } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { useSession } from "@/lib/auth-client";
import { postInitPayment, getMyPayments, getPaymentConfig, getMyEntitlement, ApiError, type PaymentRow, type Entitlement } from "@/lib/api";

// Premium price (ETB). Real checkout opens the provider; the stub URL is a
// placeholder until ETB provider keys are configured.
const PREMIUM_PRICE_ETB = 500;

export default function AccountPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [paymentsEnabled, setPaymentsEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPending && !session) router.push("/login?next=/account");
  }, [isPending, session, router]);

  useEffect(() => {
    if (session) {
      getMyPayments().then(setPayments).catch(() => undefined);
      getMyEntitlement().then(setEntitlement).catch(() => undefined);
      getPaymentConfig().then((c) => setPaymentsEnabled(c.paymentsEnabled)).catch(() => undefined);
    }
  }, [session]);

  const buyPremium = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await postInitPayment(PREMIUM_PRICE_ETB, "telebirr");
      window.location.href = r.checkout.checkoutUrl;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start checkout.");
      setBusy(false);
    }
  };

  if (isPending || !session) return <main className="p-16 text-center text-body text-fg-muted">Loading…</main>;

  // Authority for premium status is the live entitlement (active + unexpired),
  // NOT historical payment success — a completed invoice stays "succeeded" forever
  // but the 30-day grant lapses, so inferring from payments traps expired users.
  const isPremium = entitlement?.active === true;
  const expiresLabel = entitlement?.expiresAt ? new Date(entitlement.expiresAt).toLocaleDateString() : null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        <div>
          <h1 className="text-display text-fg">Your account</h1>
          <p className="mt-1 text-body text-fg-muted">{session.user.name ? `${session.user.name} · ` : ""}{session.user.email}</p>
        </div>

        {/* Premium */}
        <div className="card relative overflow-hidden border-brand-200 p-7">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-50 to-transparent" />
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white shadow-brand">
                <Crown className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lead font-bold text-fg">{isPremium ? "Premium active" : "Go Premium"}</h2>
                <p className="mt-1 max-w-md text-body text-fg-muted">
                  {isPremium
                    ? expiresLabel
                      ? `Full reports and complete vehicle history are unlocked through ${expiresLabel}.`
                      : "You can unlock full reports and complete vehicle history."
                    : !paymentsEnabled
                      ? "Payments are temporarily unavailable. Please check back soon."
                      : `Unlock full specs, complete history and health grades — ${PREMIUM_PRICE_ETB} ETB / 30 days.`}
                </p>
              </div>
            </div>
            {!isPremium && paymentsEnabled && (
              <button onClick={buyPremium} disabled={busy} className="btn-brand shrink-0">
                {busy ? "Starting…" : "Get premium"}
              </button>
            )}
          </div>
          {error && <p className="relative mt-3 rounded-lg bg-error/10 px-3 py-2 text-body text-error">{error}</p>}
        </div>

        {/* Payments */}
        <div className="card p-6">
          <h2 className="text-title text-fg">Payments</h2>
          {payments.length === 0 ? (
            <p className="mt-3 text-body text-fg-muted">No payments yet.</p>
          ) : (
            <table className="mt-4 w-full text-body">
              <thead>
                <tr className="text-left text-caption uppercase tracking-wide text-fg-muted">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Provider</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2 text-fg-muted">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 font-semibold text-fg">{p.amount} {p.currency}</td>
                    <td className="py-2 text-fg-muted">{p.provider ?? "—"}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-caption font-bold ${p.status === "succeeded" ? "bg-success/15 text-success" : "bg-surface-2 text-fg-muted"}`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Link href="/" className="btn-ghost inline-flex">
          <ScanLine className="h-5 w-5" /> Decode a VIN
        </Link>
      </main>
    </>
  );
}
