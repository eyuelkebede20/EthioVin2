import crypto from "node:crypto";
import { AppError } from "../middleware/errorHandler.ts";

// Chapa (ETB) integration. Missing config disables billing with a 503 rather than
// crashing the app — decoding must keep working without billing config in dev.

const CHAPA_BASE = "https://api.chapa.co/v1";

export function chapaConfigured(): boolean {
  return !!process.env.CHAPA_SECRET_KEY;
}

function secretKey(): string {
  const k = process.env.CHAPA_SECRET_KEY;
  if (!k) throw new AppError(503, "Billing is not configured");
  return k;
}

/** Initialize a checkout; returns the hosted payment URL. */
export async function initializePayment(args: {
  amount: number;
  txRef: string;
  email?: string | undefined;
  firstName?: string | undefined;
  returnUrl: string;
}): Promise<{ checkoutUrl: string }> {
  const res = await fetch(`${CHAPA_BASE}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: String(args.amount),
      currency: "ETB",
      tx_ref: args.txRef,
      return_url: args.returnUrl,
      email: args.email,
      first_name: args.firstName,
    }),
  });
  const data = (await res.json().catch(() => null)) as { status?: string; data?: { checkout_url?: string }; message?: string } | null;
  if (!res.ok || data?.status !== "success" || !data.data?.checkout_url) {
    console.error("[chapa] initialize failed:", res.status, data?.message);
    throw new AppError(502, "Payment initialization failed");
  }
  return { checkoutUrl: data.data.checkout_url };
}

/** Authoritative verify — the webhook alone is spoofable, this call is the source of truth. */
export async function verifyPayment(txRef: string): Promise<{ paid: boolean; amount: number; currency: string }> {
  const res = await fetch(`${CHAPA_BASE}/transaction/verify/${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const data = (await res.json().catch(() => null)) as { status?: string; data?: { status?: string; amount?: string | number; currency?: string } } | null;
  if (!res.ok || !data) return { paid: false, amount: 0, currency: "ETB" };
  const paid = data.status === "success" && data.data?.status === "success";
  return { paid, amount: Number(data.data?.amount ?? 0), currency: data.data?.currency ?? "ETB" };
}

function safeEqHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify the webhook HMAC over the RAW body. Chapa implementations vary between
 * signing the payload and signing the secret hash itself — accept either.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  const secret = process.env.CHAPA_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const bodyHmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const secretHmac = crypto.createHmac("sha256", secret).update(secret).digest("hex");
  const sig = signature.trim().toLowerCase();
  return safeEqHex(sig, bodyHmac) || safeEqHex(sig, secretHmac);
}
