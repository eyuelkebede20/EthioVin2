// Thin fetch wrapper around the EthioVin API. Works on the server (RSC/SSR) and
// the client. Server-side reads use NEXT_PUBLIC_BACKEND_URL too (same origin).

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit & { cache?: RequestCache }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, "Network error — is the API running?");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? `Request failed (${res.status})`);
  return data as T;
}

// --- Decode view shapes (mirror backend src/services/decodeView.ts) ----------

export interface VehicleIdentity {
  vin: string;
  manufacturer?: string | null;
  model?: string | null;
  year?: string | null;
  image_url?: string | null;
  wmi?: string | null;
  vds?: string | null;
  vis?: string | null;
  country?: string | null;
}

export interface FreeDecodeView {
  tier: "free";
  vehicle: VehicleIdentity;
  specs: Record<string, Record<string, unknown>>;
  historyAvailable: number;
  premiumLocked: true;
}

export interface PremiumDecodeView {
  tier: "premium";
  vehicle: VehicleIdentity;
  specs: Record<string, unknown>;
  history: unknown[];
}

export type DecodeView = FreeDecodeView | PremiumDecodeView;

/** Public free decode (SSR-safe). Revalidate hourly — identity rarely changes. */
export function fetchFreeDecode(vin: string): Promise<FreeDecodeView> {
  return api<FreeDecodeView>(`/api/v1/decode/${encodeURIComponent(vin)}`, { next: { revalidate: 3600 } } as RequestInit);
}

// --- Payments ----------------------------------------------------------------

export interface InitPaymentResp {
  paymentId: string;
  providerRef: string;
  status: string;
  checkout: { checkoutUrl: string; stub: boolean };
}

export function postInitPayment(amount: number, provider: string): Promise<InitPaymentResp> {
  return api<InitPaymentResp>("/api/v1/payments/init", { method: "POST", body: JSON.stringify({ amount, provider }) });
}

export interface PaymentRow {
  id: string;
  amount: string;
  currency: string;
  provider: string | null;
  status: string;
  createdAt: string;
}

export function getMyPayments(): Promise<PaymentRow[]> {
  return api<PaymentRow[]>("/api/v1/payments/me", { cache: "no-store" } as RequestInit);
}
