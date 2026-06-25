import type { Request, Response } from "express";
import { db } from "../db/index.ts";
import { wmi_mapping, organizations, organization_members, data_sharing_agreements, user, vehicle_events, credit_ledger, data_flags, field_claims, contributor_scores, premium_access, payments } from "../db/schema.ts";
import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { AppError } from "../middleware/errorHandler.ts";
import { updateWmiSchema, createOrgSchema, addOrgMemberSchema, dataSharingAgreementSchema, updateSettingsSchema } from "../utils/validation.ts";
import { getPaymentsEnabled, setSetting, SETTING_KEYS } from "../services/settingsService.ts";

/** WMIs we've seen but can't attribute to a manufacturer yet. */
export const getUnknownWMIs = async (_req: Request, res: Response) => {
  const unknowns = await db.select().from(wmi_mapping).where(eq(wmi_mapping.manufacturer, "Unknown"));
  return res.json(unknowns);
};

/** Distinct known manufacturers (excludes "Unknown"/blank), for select menus. */
export const getDistinctManufacturers = async (_req: Request, res: Response) => {
  // Exclude null / "Unknown" / blank and sort in SQL so the DB returns only the
  // rows we actually use, already ordered — no JS filter/sort over the full table.
  const result = await db
    .selectDistinct({ manufacturer: wmi_mapping.manufacturer })
    .from(wmi_mapping)
    .where(and(isNotNull(wmi_mapping.manufacturer), ne(wmi_mapping.manufacturer, "Unknown"), ne(sql`trim(${wmi_mapping.manufacturer})`, "")))
    .orderBy(wmi_mapping.manufacturer);

  return res.json(result.map((r) => r.manufacturer));
};

/**
 * Attribute a manufacturer (and optional country) to an existing WMI. This only
 * UPDATEs — new WMIs are seeded by the save path — so a missing WMI is a 404.
 */
export const updateWMI = async (req: Request, res: Response) => {
  const { wmi, manufacturer, country } = updateWmiSchema.parse(req.body);

  const updated = await db
    .update(wmi_mapping)
    .set({ manufacturer, country: country ?? null, updated_at: new Date() })
    .where(eq(wmi_mapping.wmi, wmi))
    .returning({ wmi: wmi_mapping.wmi });

  if (!updated[0]) throw new AppError(404, "WMI not found");

  return res.json({ success: true });
};

// ---------------------------------------------------------------------------
// Org onboarding (super_admin)
// ---------------------------------------------------------------------------

/** Create an organization (garage / insurer / diagnostic). */
export const createOrg = async (req: Request, res: Response) => {
  const body = createOrgSchema.parse(req.body);
  const [row] = await db.insert(organizations).values({ name: body.name, type: body.type, country: body.country ?? null, city: body.city ?? null }).returning();
  return res.status(201).json(row);
};

/** List every organization with member + active-agreement counts (for the admin
 *  console — so onboarding isn't done by blind copy-paste of IDs). */
export const listOrgs = async (_req: Request, res: Response) => {
  const orgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
  const memberCounts = await db
    .select({ orgId: organization_members.orgId, c: sql<number>`count(*)::int` })
    .from(organization_members)
    .groupBy(organization_members.orgId);
  const agreementCounts = await db
    .select({ orgId: data_sharing_agreements.orgId, c: sql<number>`count(*)::int` })
    .from(data_sharing_agreements)
    .where(eq(data_sharing_agreements.status, "active"))
    .groupBy(data_sharing_agreements.orgId);

  const members = new Map(memberCounts.map((m) => [m.orgId, m.c]));
  const agreements = new Map(agreementCounts.map((a) => [a.orgId, a.c]));
  return res.json(orgs.map((o) => ({ ...o, memberCount: members.get(o.id) ?? 0, activeAgreements: agreements.get(o.id) ?? 0 })));
};

/** One org with its members (joined to user email) and its agreements. */
export const getOrgDetail = async (req: Request, res: Response) => {
  const id = String(req.params.id ?? "");
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!org) throw new AppError(404, "Organization not found");

  const members = await db
    .select({ id: organization_members.id, userId: organization_members.userId, orgRole: organization_members.orgRole, createdAt: organization_members.createdAt, email: user.email, name: user.name })
    .from(organization_members)
    .leftJoin(user, eq(organization_members.userId, user.id))
    .where(eq(organization_members.orgId, id))
    .orderBy(desc(organization_members.createdAt));

  const agreements = await db
    .select()
    .from(data_sharing_agreements)
    .where(eq(data_sharing_agreements.orgId, id))
    .orderBy(desc(data_sharing_agreements.acceptedAt));

  return res.json({ org, members, agreements });
};

/** Add an existing user (by email) as a member of an org. */
export const addOrgMember = async (req: Request, res: Response) => {
  const body = addOrgMemberSchema.parse(req.body);

  const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, body.orgId)).limit(1);
  if (!org) throw new AppError(404, "Organization not found");

  // better-auth stores emails lower-cased; match case-insensitively to be safe.
  const [u] = await db.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${body.email}`).limit(1);
  if (!u) throw new AppError(404, "User not found");

  const [row] = await db.insert(organization_members).values({ orgId: body.orgId, userId: u.id, orgRole: body.orgRole ?? "member" }).returning();
  return res.status(201).json(row);
};

/** Create an ACTIVE data-sharing agreement — what unlocks the insurer exchange. */
export const createAgreement = async (req: Request, res: Response) => {
  const adminId = req.user?.id;
  if (!adminId) throw new AppError(401, "Unauthorized");
  const body = dataSharingAgreementSchema.parse(req.body);

  const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, body.orgId)).limit(1);
  if (!org) throw new AppError(404, "Organization not found");

  const [row] = await db.insert(data_sharing_agreements).values({ orgId: body.orgId, scope: body.scope, acceptedBy: adminId, status: "active" }).returning();
  return res.status(201).json(row);
};

/** Revoke an agreement (cuts off the exchange for that org). */
export const revokeAgreement = async (req: Request, res: Response) => {
  const id = String(req.params.id ?? "");
  const updated = await db.update(data_sharing_agreements).set({ status: "revoked", revokedAt: new Date() }).where(eq(data_sharing_agreements.id, id)).returning({ id: data_sharing_agreements.id });
  if (!updated[0]) throw new AppError(404, "Agreement not found");
  return res.json({ success: true });
};

// ---------------------------------------------------------------------------
// GET /admin/analytics — super_admin dashboard counts.
// ---------------------------------------------------------------------------
export const getAnalytics = async (_req: Request, res: Response) => {
  const [users] = await db.select({ c: sql<number>`count(*)::int` }).from(user);
  const orgsByType = await db.select({ type: organizations.type, count: sql<number>`count(*)::int` }).from(organizations).groupBy(organizations.type);
  const eventsByType = await db.select({ type: vehicle_events.eventType, count: sql<number>`count(*)::int` }).from(vehicle_events).groupBy(vehicle_events.eventType);
  const [credits] = await db.select({ issued: sql<string>`coalesce(sum(${credit_ledger.delta}) filter (where ${credit_ledger.delta} > 0), 0)` }).from(credit_ledger);
  const [flagsOpen] = await db.select({ c: sql<number>`count(*)::int` }).from(data_flags).where(sql`${data_flags.status} in ('open','corroborating')`);
  const [flagsResolved] = await db.select({ c: sql<number>`count(*)::int` }).from(data_flags).where(eq(data_flags.status, "resolved"));
  const [premiumUsers] = await db.select({ c: sql<number>`count(distinct ${premium_access.userId})::int` }).from(premium_access).where(and(eq(premium_access.tier, "premium"), eq(premium_access.status, "active")));
  const [paymentsSucceeded] = await db.select({ c: sql<number>`count(*)::int` }).from(payments).where(eq(payments.status, "succeeded"));

  return res.json({
    users: users?.c ?? 0,
    orgsByType,
    eventsByType,
    creditsIssued: Number(credits?.issued ?? 0),
    flagsOpen: flagsOpen?.c ?? 0,
    flagsResolved: flagsResolved?.c ?? 0,
    premiumUsers: premiumUsers?.c ?? 0,
    paymentsSucceeded: paymentsSucceeded?.c ?? 0,
  });
};

// ---------------------------------------------------------------------------
// Trust & fraud oversight (super_admin) — READ-ONLY. The trust state machine
// (trustService) owns score changes; this just surfaces them for review.
// ---------------------------------------------------------------------------

/** Contributor trust scores (the "Upwork rating"), worst first so fraud surfaces. */
export const listContributors = async (_req: Request, res: Response) => {
  const rows = await db
    .select({ userId: contributor_scores.userId, score: contributor_scores.score, updatedAt: contributor_scores.updatedAt, email: user.email, name: user.name })
    .from(contributor_scores)
    .leftJoin(user, eq(contributor_scores.userId, user.id))
    .orderBy(contributor_scores.score, desc(contributor_scores.updatedAt))
    .limit(500);
  return res.json(rows);
};

/** Data-flag queue: each conflicting (vin, field) with its competing entries
 *  (who claimed what), newest first. Drives the fraud-review UI. */
export const listFlags = async (_req: Request, res: Response) => {
  const flags = await db.select().from(data_flags).orderBy(desc(data_flags.createdAt)).limit(200);
  if (flags.length === 0) return res.json([]);

  const flagIds = flags.map((f) => f.id);
  const claims = await db
    .select({ id: field_claims.id, flagId: field_claims.flagId, value: field_claims.value, userId: field_claims.userId, email: user.email, createdAt: field_claims.createdAt })
    .from(field_claims)
    .leftJoin(user, eq(field_claims.userId, user.id))
    .where(inArray(field_claims.flagId, flagIds))
    .orderBy(field_claims.createdAt);

  const byFlag = new Map<string, typeof claims>();
  for (const c of claims) {
    if (!c.flagId) continue;
    const list = byFlag.get(c.flagId) ?? [];
    list.push(c);
    byFlag.set(c.flagId, list);
  }
  return res.json(flags.map((f) => ({ ...f, claims: byFlag.get(f.id) ?? [] })));
};

// ---------------------------------------------------------------------------
// Feature settings (super_admin) — currently the payments on/off toggle.
// ---------------------------------------------------------------------------
export const getSettings = async (_req: Request, res: Response) => {
  return res.json({ paymentsEnabled: await getPaymentsEnabled() });
};

export const updateSettings = async (req: Request, res: Response) => {
  const body = updateSettingsSchema.parse(req.body);
  if (body.paymentsEnabled !== undefined) await setSetting(SETTING_KEYS.paymentsEnabled, body.paymentsEnabled);
  return res.json({ success: true, paymentsEnabled: await getPaymentsEnabled() });
};
