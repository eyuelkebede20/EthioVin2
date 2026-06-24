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

// --- Garage management (org-scoped server-side; client just calls with cookie) ---

export type JobStatus = "intake" | "in_progress" | "awaiting_parts" | "done" | "delivered" | "cancelled";
export const JOB_STATUSES: JobStatus[] = ["intake", "in_progress", "awaiting_parts", "done", "delivered", "cancelled"];

export interface JobItem {
  id?: string;
  kind: "labor" | "part";
  description: string;
  qty: number | string;
  unitCost: number | string;
}
export interface Job {
  id: string;
  vin: string | null;
  customerId: string | null;
  status: JobStatus;
  odometerIn: number | null;
  totalCost: string;
  openedAt: string;
  closedAt: string | null;
  paid: boolean;
  paidAt: string | null;
  items?: JobItem[];
  closed?: boolean;
}
export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
}
export interface Appointment {
  id: string;
  vin: string | null;
  customerId: string | null;
  scheduledAt: string;
  status: string;
}
export interface Part {
  id: string;
  name: string;
  sku: string | null;
  qtyOnHand: number;
  reorderLevel: number;
  unitCost: string;
}
export interface Invoice {
  invoiceNumber: string;
  job: { id: string; vin: string | null; status: string; openedAt: string; closedAt: string | null };
  customer: { name: string; phone: string | null } | null;
  lines: Array<JobItem & { lineTotal: number }>;
  subtotal: number;
  total: number;
  paid: boolean;
  paidAt: string | null;
}

const noStore = { cache: "no-store" } as RequestInit;

export const garageApi = {
  listJobs: (status?: string) => api<Job[]>(`/api/v1/garage/jobs${status ? `?status=${status}` : ""}`, noStore),
  getJob: (id: string) => api<Job>(`/api/v1/garage/jobs/${id}`, noStore),
  createJob: (body: { vin?: string; customerId?: string; odometerIn?: number; items?: JobItem[] }) => api<Job>("/api/v1/garage/jobs", { method: "POST", body: JSON.stringify(body) }),
  updateJob: (id: string, body: { status?: JobStatus; odometerIn?: number; items?: JobItem[] }) => api<Job>(`/api/v1/garage/jobs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  getInvoice: (id: string) => api<Invoice>(`/api/v1/garage/jobs/${id}/invoice`, noStore),
  payInvoice: (id: string) => api<{ id: string; paid: boolean; paidAt: string }>(`/api/v1/garage/jobs/${id}/pay`, { method: "PATCH" }),
  listCustomers: () => api<Customer[]>("/api/v1/garage/customers", noStore),
  createCustomer: (body: { name: string; phone?: string }) => api<Customer>("/api/v1/garage/customers", { method: "POST", body: JSON.stringify(body) }),
  listAppointments: (status?: string) => api<Appointment[]>(`/api/v1/garage/appointments${status ? `?status=${status}` : ""}`, noStore),
  createAppointment: (body: { vin?: string; customerId?: string; scheduledAt: string }) => api<Appointment>("/api/v1/garage/appointments", { method: "POST", body: JSON.stringify(body) }),
  listParts: (lowStock?: boolean) => api<Part[]>(`/api/v1/garage/parts${lowStock ? "?lowStock=true" : ""}`, noStore),
  createPart: (body: { name: string; sku?: string; qtyOnHand?: number; reorderLevel?: number; unitCost?: number }) => api<Part>("/api/v1/garage/parts", { method: "POST", body: JSON.stringify(body) }),
  updatePart: (id: string, body: { qtyDelta?: number; qtyOnHand?: number; reorderLevel?: number; unitCost?: number }) => api<Part>(`/api/v1/garage/parts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};

// --- Insurer reciprocal exchange ---------------------------------------------

export interface HealthGrade {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  factors: string[];
}
export interface InsurerVehicleView {
  vehicle: VehicleIdentity;
  healthGrade: HealthGrade;
  eventSummary: Array<{ type: string; count: number; lastAt: string | null }>;
}

export const insurerApi = {
  // EGRESS: minimized insurer view — identity + grade + event counts only (no PII).
  lookupVehicle: (vin: string) => api<InsurerVehicleView>(`/api/v1/insurance/vehicles/${encodeURIComponent(vin)}`, { cache: "no-store" } as RequestInit),
  // INTAKE: only the health signal is sent/stored; the server drops anything else.
  submitClaim: (body: { vin: string; incidentType: string; severityBand: number; incidentDate?: string; payoutBand?: string }) =>
    api<{ ok: boolean; claimId: string }>("/api/v1/insurance/claims", { method: "POST", body: JSON.stringify(body) }),
  submitPolice: (body: { vin: string; incidentType: string; severityBand?: number; incidentDate?: string; reportRef?: string }) =>
    api<{ ok: boolean; reportId: string }>("/api/v1/insurance/police-reports", { method: "POST", body: JSON.stringify(body) }),
};
