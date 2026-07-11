// src/db/schema.ts  — corrected
import { pgTable, jsonb, varchar, integer, numeric, primaryKey, index, pgEnum, timestamp, foreignKey, uuid, bigserial, unique } from "drizzle-orm/pg-core";
import { text, boolean } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["pending", "verified", "rejected", "conflict"]);
export const fuelEnum = pgEnum("fuel", ["petrol", "diesel", "hybrid", "electric"]);
export const transEnum = pgEnum("transmission", ["manual", "automatic", "cvt"]);
export const bodyStyleEnum = pgEnum("body_style", ["sedan", "suv", "hatchback", "single_cab", "double_cab", "minivan", "van", "truck"]);

// ITEM 4: added `country` and `updated_at` so adminController.updateWMI's .set() matches real columns.
export const wmi_mapping = pgTable("wmi_mapping", {
  wmi: varchar("wmi", { length: 3 }).primaryKey(),
  manufacturer: varchar("manufacturer", { length: 100 }).notNull().default("Unknown"),
  country: varchar("country", { length: 100 }),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const nhtsa_models = pgTable(
  "nhtsa_models",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
  },
  // ITEM 16: index on make, since the NHTSA fallback in processVin queries by manufacturer.
  (table) => ({
    makeIdx: index("nhtsa_make_idx").on(table.make),
  }),
);

export const vehicle_specs = pgTable("vehicle_specs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  hardware_specs: jsonb("hardware_specs").notNull(),
});

export const vds_cache = pgTable(
  "vds_cache",
  {
    wmi: varchar("wmi", { length: 3 })
      .notNull()
      .references(() => wmi_mapping.wmi),
    // ITEM 5: 6 -> 5 so it matches verification_log, the composite FK, and vin.substring(3,8).
    vds_code: varchar("vds_code", { length: 5 }).notNull(),
    spec_id: integer("spec_id")
      .references(() => vehicle_specs.id)
      .notNull(),
    status: statusEnum("status").default("pending").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  // ITEM 16: dropped the separate wmi_vds_search_idx — the composite PK already indexes (wmi, vds_code).
  (table) => ({
    pk: primaryKey({ columns: [table.wmi, table.vds_code] }),
  }),
);

export const verification_log = pgTable(
  "verification_log",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    wmi: varchar("wmi", { length: 3 }).notNull(),
    vds_code: varchar("vds_code", { length: 5 }).notNull(),
    proposed_spec_id: integer("proposed_spec_id")
      .references(() => vehicle_specs.id)
      .notNull(),
    // ITEM 2: integer -> text + FK to user.id (better-auth user ids are text).
    admin_id: text("admin_id")
      .notNull()
      .references(() => user.id),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => ({
    fk: foreignKey({
      columns: [table.wmi, table.vds_code],
      foreignColumns: [vds_cache.wmi, vds_cache.vds_code],
    }),
  }),
);

export const userRoleEnum = pgEnum("user_role", ["super_admin", "garage_admin", "diagnostician", "insurance", "user"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  banned: boolean("banned"),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  impersonatedBy: text("impersonatedBy"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});

export const vehicle_ledger = pgTable(
  "vehicle_ledger",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    vin: varchar("vin", { length: 17 }).notNull().unique(),
    manufacturer: text("manufacturer").notNull(),
    year: text("year").notNull(),
    model: text("model").notNull(),
    image_url: text("image_url"),
    wmi: text("wmi"),
    vds: text("vds"),
    vis: text("vis"),
    plant: text("plant"),
    country: text("country"),
    hardware_specs: jsonb("hardware_specs").notNull(),
    scannedBy: text("scannedBy")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  // ITEM 16: dropped vin_search_idx — .unique() on vin already creates an index.
  () => ({}),
);

// ============================================================================
// MILESTONE 2 — platform tables (additive). See MILESTONE_2_PLAN.md.
// vehicle_events is the spine: every contributor input becomes a trust-weighted,
// credit-earning history record. Trust/credit are neutral infra (redemption flag-gated).
// ============================================================================

export const orgTypeEnum = pgEnum("org_type", ["garage", "insurer", "diagnostic"]);
export const eventTypeEnum = pgEnum("event_type", ["inspection", "repair", "maintenance", "odometer", "ownership", "insurance_claim", "police_report", "accident"]);
export const eventStatusEnum = pgEnum("event_status", ["active", "flagged", "disputed", "rejected"]);
export const flagStatusEnum = pgEnum("flag_status", ["open", "corroborating", "resolved", "dismissed"]);
export const creditReasonEnum = pgEnum("credit_reason", ["data_input", "verification", "referral", "redemption", "penalty", "exchange"]);
export const jobStatusEnum = pgEnum("job_status", ["intake", "in_progress", "awaiting_parts", "done", "delivered", "cancelled"]);
export const tierEnum = pgEnum("tier", ["free", "premium"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "succeeded", "failed", "refunded"]);
export const agreementStatusEnum = pgEnum("agreement_status", ["active", "revoked"]);

// --- Identity / access expansion ---------------------------------------------

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 200 }).notNull(),
  type: orgTypeEnum("type").notNull(),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organization_members = pgTable(
  "organization_members",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    orgId: text("org_id").notNull().references(() => organizations.id),
    userId: text("user_id").notNull().references(() => user.id),
    orgRole: varchar("org_role", { length: 40 }).default("member").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("org_members_org_idx").on(t.orgId),
    userIdx: index("org_members_user_idx").on(t.userId),
  }),
);

// The in-system lawful basis for the reciprocal insurer data exchange (§3b).
export const data_sharing_agreements = pgTable(
  "data_sharing_agreements",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    orgId: text("org_id").notNull().references(() => organizations.id),
    scope: jsonb("scope").notNull(), // what this org may submit / pull
    acceptedBy: text("accepted_by").notNull().references(() => user.id),
    acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
    status: agreementStatusEnum("status").default("active").notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => ({ orgIdx: index("dsa_org_idx").on(t.orgId) }),
);

// --- Premium / payments ------------------------------------------------------

export const premium_access = pgTable(
  "premium_access",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => user.id),
    tier: tierEnum("tier").default("free").notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (t) => ({ userIdx: index("premium_user_idx").on(t.userId) }),
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => user.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 8 }).default("ETB").notNull(),
    provider: varchar("provider", { length: 40 }),
    providerRef: varchar("provider_ref", { length: 200 }),
    // Idempotency: a duplicate provider webhook must grant premium exactly once.
    idempotencyKey: varchar("idempotency_key", { length: 200 }).unique(),
    status: paymentStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ userIdx: index("payments_user_idx").on(t.userId) }),
);

// --- Vehicle history spine ---------------------------------------------------

export const vehicle_events = pgTable(
  "vehicle_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    vin: varchar("vin", { length: 17 }).notNull(),
    eventType: eventTypeEnum("event_type").notNull(),
    occurredAt: timestamp("occurred_at"),
    recordedBy: text("recorded_by").references(() => user.id),
    orgId: text("org_id").references(() => organizations.id),
    sourceType: varchar("source_type", { length: 40 }),
    payload: jsonb("payload").notNull(),
    trustWeight: numeric("trust_weight", { precision: 5, scale: 2 }).default("1.00").notNull(),
    status: eventStatusEnum("status").default("active").notNull(),
    creditAwarded: numeric("credit_awarded", { precision: 12, scale: 2 }).default("0").notNull(),
    // Dedup a re-submitted input: (org, vin, type, occurredAt) hashed by the writer.
    idempotencyKey: varchar("idempotency_key", { length: 200 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    vinIdx: index("events_vin_idx").on(t.vin),
    vinTypeIdx: index("events_vin_type_idx").on(t.vin, t.eventType),
    recordedByIdx: index("events_recorded_by_idx").on(t.recordedBy),
    occurredIdx: index("events_occurred_idx").on(t.occurredAt),
  }),
);

// Odometer is fraud-critical: a later reading lower than an earlier one = rollback → flag.
export const odometer_readings = pgTable(
  "odometer_readings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    vin: varchar("vin", { length: 17 }).notNull(),
    readingKm: integer("reading_km").notNull(),
    readAt: timestamp("read_at"),
    source: varchar("source", { length: 40 }),
    recordedBy: text("recorded_by").references(() => user.id),
    orgId: text("org_id").references(() => organizations.id),
    flagged: boolean("flagged").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ vinIdx: index("odo_vin_idx").on(t.vin) }),
);

// --- Regulated tables (minimized; encryption-at-rest + RLS + audit at the app layer) ---

export const insurance_claims = pgTable(
  "insurance_claims",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    orgId: text("org_id").notNull().references(() => organizations.id),
    vin: varchar("vin", { length: 17 }).notNull(),
    // Minimized: only the derived health signal is stored — never the raw claim/PII.
    incidentType: varchar("incident_type", { length: 40 }).notNull(),
    severityBand: integer("severity_band").notNull(), // 1–5
    incidentDate: timestamp("incident_date"),
    payoutBand: varchar("payout_band", { length: 20 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgDateIdx: index("claims_org_date_idx").on(t.orgId, t.incidentDate),
    vinIdx: index("claims_vin_idx").on(t.vin),
  }),
);

export const police_reports = pgTable(
  "police_reports",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    vin: varchar("vin", { length: 17 }).notNull(),
    reportRef: varchar("report_ref", { length: 100 }),
    incidentType: varchar("incident_type", { length: 40 }).notNull(),
    severityBand: integer("severity_band"),
    incidentDate: timestamp("incident_date"),
    sourceOrgId: text("source_org_id").references(() => organizations.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ vinIdx: index("police_vin_idx").on(t.vin) }),
);

// --- Garage management -------------------------------------------------------

export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    orgId: text("org_id").notNull().references(() => organizations.id),
    name: varchar("name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ orgIdx: index("customers_org_idx").on(t.orgId) }),
);

export const garage_jobs = pgTable(
  "garage_jobs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    orgId: text("org_id").notNull().references(() => organizations.id),
    vin: varchar("vin", { length: 17 }),
    customerId: text("customer_id").references(() => customers.id),
    status: jobStatusEnum("status").default("intake").notNull(),
    odometerIn: integer("odometer_in"),
    totalCost: numeric("total_cost", { precision: 12, scale: 2 }).default("0").notNull(),
    openedAt: timestamp("opened_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
    paid: boolean("paid").default(false).notNull(),
    paidAt: timestamp("paid_at"),
    createdBy: text("created_by").references(() => user.id),
  },
  (t) => ({
    orgStatusIdx: index("jobs_org_status_idx").on(t.orgId, t.status),
    vinIdx: index("jobs_vin_idx").on(t.vin),
  }),
);

export const garage_job_items = pgTable(
  "garage_job_items",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    jobId: text("job_id").notNull().references(() => garage_jobs.id),
    kind: varchar("kind", { length: 20 }).notNull(), // "labor" | "part"
    description: varchar("description", { length: 300 }).notNull(),
    qty: numeric("qty", { precision: 10, scale: 2 }).default("1").notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  },
  (t) => ({ jobIdx: index("job_items_job_idx").on(t.jobId) }),
);

export const appointments = pgTable(
  "appointments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    orgId: text("org_id").notNull().references(() => organizations.id),
    vin: varchar("vin", { length: 17 }),
    customerId: text("customer_id").references(() => customers.id),
    scheduledAt: timestamp("scheduled_at").notNull(),
    status: varchar("status", { length: 20 }).default("scheduled").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ orgIdx: index("appts_org_idx").on(t.orgId) }),
);

export const parts = pgTable(
  "parts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    orgId: text("org_id").notNull().references(() => organizations.id),
    name: varchar("name", { length: 200 }).notNull(),
    sku: varchar("sku", { length: 80 }),
    qtyOnHand: integer("qty_on_hand").default(0).notNull(),
    reorderLevel: integer("reorder_level").default(0).notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  },
  (t) => ({ orgIdx: index("parts_org_idx").on(t.orgId) }),
);

// --- Trust / fraud scoring (Upwork-style) ------------------------------------

export const contributor_scores = pgTable("contributor_scores", {
  userId: text("user_id").primaryKey().references(() => user.id),
  score: numeric("score", { precision: 5, scale: 2 }).default("100.00").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// A field conflict for a VIN. No entry is authoritative until corroborated;
// scores change only when a flag RESOLVES, never on entry. (See plan §4.2.)
export const data_flags = pgTable(
  "data_flags",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    vin: varchar("vin", { length: 17 }).notNull(),
    field: varchar("field", { length: 60 }).notNull(),
    status: flagStatusEnum("status").default("open").notNull(),
    entriesCount: integer("entries_count").default(1).notNull(),
    resolvedValue: text("resolved_value"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => ({ vinFieldIdx: index("flags_vin_field_idx").on(t.vin, t.field, t.status) }),
);

export const score_adjustments = pgTable(
  "score_adjustments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => user.id),
    delta: numeric("delta", { precision: 6, scale: 2 }).notNull(),
    reason: varchar("reason", { length: 120 }).notNull(),
    flagId: text("flag_id").references(() => data_flags.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ userIdx: index("score_adj_user_idx").on(t.userId) }),
);

// --- Credit / reward economy (neutral infra; redemption flag-gated) ----------

export const credit_ledger = pgTable(
  "credit_ledger",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => user.id),
    delta: numeric("delta", { precision: 12, scale: 2 }).notNull(),
    reason: creditReasonEnum("reason").notNull(),
    eventId: text("event_id"),
    // Running balance so reads don't SUM() the whole ledger.
    balanceAfter: numeric("balance_after", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ userIdx: index("credit_user_idx").on(t.userId) }),
);

// --- Audit (append-only) — every sensitive read/write -----------------------

export const audit_log = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    actorUserId: text("actor_user_id").references(() => user.id),
    action: varchar("action", { length: 80 }).notNull(),
    resourceType: varchar("resource_type", { length: 60 }),
    resourceId: text("resource_id"),
    orgId: text("org_id"),
    ip: varchar("ip", { length: 60 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
    at: timestamp("at").defaultNow().notNull(),
  },
  (t) => ({
    actorIdx: index("audit_actor_idx").on(t.actorUserId),
    resourceIdx: index("audit_resource_idx").on(t.resourceType, t.resourceId),
  }),
);

// Key/value app settings (super_admin-toggled feature flags, e.g. payments on/off).
export const app_settings = pgTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// One row per asserted (vin, field, value) by a contributor. The corroboration
// engine tallies these to resolve a conflict by majority and identify the
// minority to penalize. (Trust scores change only when a flag RESOLVES.)
export const field_claims = pgTable(
  "field_claims",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    vin: varchar("vin", { length: 17 }).notNull(),
    field: varchar("field", { length: 60 }).notNull(),
    value: text("value").notNull(),
    userId: text("user_id").references(() => user.id),
    flagId: text("flag_id").references(() => data_flags.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ vinFieldIdx: index("field_claims_vin_field_idx").on(t.vin, t.field) }),
);

// ===========================================================================
// Milestone 3 — the public API platform (additive; see claude.milestone3.md §3)
// Six new tables, zero changes to existing ones. Owner FKs are text -> user.id
// (better-auth ids are text). There is deliberately NO wallet table here — the
// ONE credit balance lives in credit_ledger and is reached through creditBridge.
// ===========================================================================

export const apiKeyStatusEnum = pgEnum("api_key_status", ["active", "revoked"]);
export const apiRequestResultEnum = pgEnum("api_request_result", ["exact", "model", "parse_only", "invalid", "error"]);
export const promoStatusEnum = pgEnum("promo_status", ["active", "disabled"]);
export const purchaseStatusEnum = pgEnum("purchase_status", ["pending", "paid", "failed"]);

// A developer's API key. The raw key is shown ONCE at creation; only its SHA-256
// hex hash is stored (keyHash is the lookup column). keyPrefix/last4 are display-only.
export const apiKey = pgTable("api_key", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id),
  name: varchar("name", { length: 64 }).notNull(),
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
  keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
  last4: varchar("last4", { length: 4 }).notNull(),
  rateLimitPerMin: integer("rate_limit_per_min").notNull().default(10),
  status: apiKeyStatusEnum("status").notNull().default("active"),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

// One row per public API request (incl. errors) — the billing-dispute record.
export const apiRequestLog = pgTable(
  "api_request_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    requestId: varchar("request_id", { length: 24 }).notNull(),
    apiKeyId: uuid("api_key_id").notNull().references(() => apiKey.id),
    endpoint: varchar("endpoint", { length: 64 }).notNull(),
    vin: varchar("vin", { length: 17 }),
    result: apiRequestResultEnum("result").notNull(),
    creditsCharged: integer("credits_charged").notNull().default(0),
    httpStatus: integer("http_status").notNull(),
    latencyMs: integer("latency_ms"),
    ip: varchar("ip", { length: 45 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("idx_api_log_key_time").on(t.apiKeyId, t.createdAt)],
);

// Idempotency cache for POST /v1/decode (Idempotency-Key header). Same key+body ->
// stored response replayed (no re-charge); same key/different body -> 409.
export const apiIdempotency = pgTable(
  "api_idempotency",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    apiKeyId: uuid("api_key_id").notNull().references(() => apiKey.id),
    idemKey: varchar("idem_key", { length: 64 }).notNull(),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    httpStatus: integer("http_status").notNull(),
    response: jsonb("response").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("uq_idem_key").on(t.apiKeyId, t.idemKey)],
);

// Promo codes granting credits (stored UPPERCASE). redeemedCount/perAccountLimit
// bound redemption; the unique(promoCodeId, ownerId) on promo_redemption is the race guard.
export const promoCode = pgTable("promo_code", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  credits: integer("credits").notNull(),
  maxRedemptions: integer("max_redemptions"),
  redeemedCount: integer("redeemed_count").notNull().default(0),
  perAccountLimit: integer("per_account_limit").notNull().default(1),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  status: promoStatusEnum("status").notNull().default("active"),
  createdBy: text("created_by").references(() => user.id),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const promoRedemption = pgTable(
  "promo_redemption",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    promoCodeId: uuid("promo_code_id").notNull().references(() => promoCode.id),
    ownerId: text("owner_id").notNull().references(() => user.id),
    credited: integer("credited").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("uq_promo_owner").on(t.promoCodeId, t.ownerId)],
);

// A Chapa credit-pack purchase. chapaTxRef is unique -> the webhook replay guard.
export const creditPurchase = pgTable("credit_purchase", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id),
  packId: varchar("pack_id", { length: 32 }).notNull(),
  credits: integer("credits").notNull(),
  amountEtb: numeric("amount_etb", { precision: 10, scale: 2 }).notNull(),
  chapaTxRef: varchar("chapa_tx_ref", { length: 64 }).notNull().unique(),
  status: purchaseStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});
