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

/**
 * Premium decode (full specs + history). Requires an active entitlement; the
 * backend returns 402 otherwise. Server components must forward the visitor's
 * cookies explicitly (server-side fetch carries no browser cookie jar), so pass
 * the Cookie header through. Never cached — it's per-user, gated data.
 */
export function fetchPremiumDecode(vin: string, cookie: string): Promise<PremiumDecodeView> {
  return api<PremiumDecodeView>(`/api/v1/decode/${encodeURIComponent(vin)}/full`, {
    cache: "no-store",
    headers: cookie ? { cookie } : {},
  } as RequestInit);
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

export function getPaymentConfig(): Promise<{ paymentsEnabled: boolean }> {
  return api<{ paymentsEnabled: boolean }>("/api/v1/payments/config", { cache: "no-store" } as RequestInit);
}

export interface Entitlement {
  active: boolean;
  expiresAt: string | null;
}

/** Current premium entitlement — the authority for "is this user premium NOW". */
export function getMyEntitlement(): Promise<Entitlement> {
  return api<Entitlement>("/api/v1/payments/me/entitlement", { cache: "no-store" } as RequestInit);
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

// --- Super-admin: analytics + onboarding -------------------------------------

export interface Analytics {
  users: number;
  orgsByType: Array<{ type: string; count: number }>;
  eventsByType: Array<{ type: string; count: number }>;
  creditsIssued: number;
  flagsOpen: number;
  flagsResolved: number;
  premiumUsers: number;
  paymentsSucceeded: number;
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  country: string | null;
  city: string | null;
  status: string;
  createdAt?: string;
}

export interface OrgListItem extends Organization {
  memberCount: number;
  activeAgreements: number;
}

export interface OrgMember {
  id: string;
  userId: string;
  orgRole: string;
  createdAt: string;
  email: string | null;
  name: string | null;
}

export interface AgreementRow {
  id: string;
  orgId: string;
  scope: Record<string, unknown>;
  acceptedBy: string;
  acceptedAt: string;
  status: string;
  revokedAt: string | null;
}

export interface OrgDetail {
  org: Organization;
  members: OrgMember[];
  agreements: AgreementRow[];
}

export interface Contributor {
  userId: string;
  score: string; // numeric — percentage 0–100
  updatedAt: string;
  email: string | null;
  name: string | null;
}

export interface FieldClaim {
  id: string;
  flagId: string | null;
  value: string;
  userId: string | null;
  email: string | null;
  createdAt: string;
}

export interface DataFlag {
  id: string;
  vin: string;
  field: string;
  status: "open" | "corroborating" | "resolved" | string;
  entriesCount: number;
  resolvedValue: string | null;
  createdAt: string;
  resolvedAt: string | null;
  claims: FieldClaim[];
}

export const adminApi = {
  getAnalytics: () => api<Analytics>("/api/v1/admin/analytics", { cache: "no-store" } as RequestInit),
  getSettings: () => api<{ paymentsEnabled: boolean }>("/api/v1/admin/settings", { cache: "no-store" } as RequestInit),
  updateSettings: (body: { paymentsEnabled?: boolean }) => api<{ success: boolean; paymentsEnabled: boolean }>("/api/v1/admin/settings", { method: "PATCH", body: JSON.stringify(body) }),
  listOrgs: () => api<OrgListItem[]>("/api/v1/admin/orgs", { cache: "no-store" } as RequestInit),
  getOrg: (id: string) => api<OrgDetail>(`/api/v1/admin/orgs/${id}`, { cache: "no-store" } as RequestInit),
  createOrg: (body: { name: string; type: string; country?: string; city?: string }) => api<Organization>("/api/v1/admin/orgs", { method: "POST", body: JSON.stringify(body) }),
  addOrgMember: (body: { orgId: string; email: string; orgRole?: string }) => api<{ id: string }>("/api/v1/admin/orgs/members", { method: "POST", body: JSON.stringify(body) }),
  createAgreement: (body: { orgId: string; scope: Record<string, unknown> }) => api<{ id: string }>("/api/v1/admin/agreements", { method: "POST", body: JSON.stringify(body) }),
  revokeAgreement: (id: string) => api<{ success: boolean }>(`/api/v1/admin/agreements/${id}/revoke`, { method: "PATCH" }),
  listContributors: () => api<Contributor[]>("/api/v1/admin/contributors", { cache: "no-store" } as RequestInit),
  listFlags: () => api<DataFlag[]>("/api/v1/admin/flags", { cache: "no-store" } as RequestInit),

  // --- M3 credit + promo management (super_admin) ---
  lookupCredits: (q: { email?: string; ownerId?: string }) => {
    const qs = new URLSearchParams(q.ownerId ? { ownerId: q.ownerId } : { email: q.email ?? "" }).toString();
    return api<CreditLookup>(`/api/v1/admin/credits/lookup?${qs}`, noStore);
  },
  grantCredits: (body: { email?: string; ownerId?: string; amount: number; note?: string }) =>
    api<{ ownerId: string; granted: number; balance: number }>("/api/v1/admin/credits/grant", { method: "POST", body: JSON.stringify(body) }),
  listPromos: () => api<{ promos: PromoRow[] }>("/api/v1/admin/promo", noStore),
  createPromo: (body: { code?: string; credits: number; maxRedemptions?: number; perAccountLimit?: number; expiresAt?: string; note?: string }) =>
    api<PromoRow>("/api/v1/admin/promo", { method: "POST", body: JSON.stringify(body) }),
  updatePromo: (id: string, status: "active" | "disabled") => api<PromoRow>(`/api/v1/admin/promo/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getPricing: () => api<AdminPricing>("/api/v1/admin/pricing", noStore),
  updatePricing: (body: AdminPricing) => api<AdminPricing>("/api/v1/admin/pricing", { method: "PATCH", body: JSON.stringify(body) }),
};

export interface AdminCreditPack {
  packId: string;
  credits: number;
  priceEtb: number;
  note: string;
}
export interface AdminPricing {
  packs: AdminCreditPack[];
  signupGrantCredits: number;
}

export interface CreditLedgerEntry {
  delta: number;
  reason: string;
  ref: string | null;
  balance_after: number;
  created_at: string;
}
export interface CreditLookup {
  user: { id: string; email: string; name: string };
  balance: number;
  recent: CreditLedgerEntry[];
}
export interface PromoRow {
  id: string;
  code: string;
  credits: number;
  maxRedemptions: number | null;
  redeemedCount: number;
  perAccountLimit: number;
  startsAt: string | null;
  expiresAt: string | null;
  status: "active" | "disabled";
  note: string | null;
  createdAt: string;
}

// --- M3 developer portal (session-authed) — API keys, usage, billing ---------

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  status: "active" | "revoked";
  rate_limit_per_min: number;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}
export interface CreatedKey {
  id: string;
  name: string;
  key: string; // raw — shown ONCE
  prefix: string;
  last4: string;
  rate_limit_per_min: number;
  created_at: string;
  signup_grant_credits: number;
}
export interface CreditPackRow {
  pack_id: string;
  credits: number;
  price_etb: number;
  note: string;
}
export interface PurchaseRow {
  tx_ref: string;
  pack_id: string;
  credits: number;
  amount_etb: string;
  status: "pending" | "paid" | "failed";
  created_at?: string;
  paid_at: string | null;
  balance?: number;
}
export interface UsageDay {
  date: string;
  decodes: number;
  hits: number;
  credits_spent: number;
}
export interface UsageSummary {
  balance: number;
  since: string;
  days: UsageDay[];
  totals: { decodes: number; hits: number; credits_spent: number; hit_ratio: number };
}
export interface BillingHistory {
  balance: number;
  purchases: PurchaseRow[];
  promo_redemptions: Array<{ code: string; credited: number; created_at: string }>;
  grants: Array<{ credits: number; kind: string; created_at: string }>;
}

export const devApi = {
  listKeys: () => api<{ keys: ApiKeyRow[] }>("/api/v1/dev/keys", noStore),
  createKey: (name: string) => api<CreatedKey>("/api/v1/dev/keys", { method: "POST", body: JSON.stringify({ name }) }),
  revokeKey: (id: string) => api<{ id: string; status: string }>(`/api/v1/dev/keys/${id}`, { method: "DELETE" }),
  usageSummary: () => api<UsageSummary>("/api/v1/dev/usage/summary", noStore),
  packs: () => api<{ currency: string; packs: CreditPackRow[] }>("/api/v1/dev/billing/packs", noStore),
  checkout: (packId: string) => api<{ checkout_url: string; tx_ref: string }>("/api/v1/dev/billing/checkout", { method: "POST", body: JSON.stringify({ packId }) }),
  purchase: (txRef: string) => api<PurchaseRow>(`/api/v1/dev/billing/purchase/${encodeURIComponent(txRef)}`, noStore),
  redeemPromo: (code: string) => api<{ credited: number; balance: number; code: string }>("/api/v1/dev/billing/promo", { method: "POST", body: JSON.stringify({ code }) }),
  history: () => api<BillingHistory>("/api/v1/dev/billing/history", noStore),
};

// --- M3 landing-page live demo (public, keyless) -----------------------------

export interface DemoDecode {
  vin: string;
  valid: boolean;
  match: "exact" | "model" | "none";
  parsed: { wmi: string; vds: string; vis: string; plant_code: string; model_year: number | null; country: string | null; manufacturer: string | null };
  vehicle: { make: string | null; model: string | null; year: number | null; image_url: string | null } | null;
  specs: Record<string, unknown> | null;
  demo: true;
}
export const demoApi = {
  vins: () => api<{ vins: string[] }>("/api/v1/dev/demo", noStore),
  decode: (vin: string) => api<DemoDecode>(`/api/v1/dev/demo/${encodeURIComponent(vin)}`, noStore),
};

// --- Spec conflicts (super_admin) — raw joined rows from /vin/conflicts -------

export interface ConflictRow {
  vds_cache: { wmi: string; vds_code: string; spec_id: string; status: string; updated_at: string | null };
  verification_log: { id: string; proposed_spec_id: string; admin_id: string; timestamp: string } | null;
  vehicle_specs: { id: string; hardware_specs: Record<string, unknown> } | null;
}

export const conflictApi = {
  list: () => api<ConflictRow[]>("/api/v1/vin/conflicts", { cache: "no-store" } as RequestInit),
  resolve: (body: { wmi: string; vds_code: string; selected_spec_id: string }) =>
    api<{ success: boolean }>("/api/v1/vin/resolve", { method: "POST", body: JSON.stringify(body) }),
};
