import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { field_claims, data_flags, score_adjustments, contributor_scores } from "../db/schema.ts";
import { AppError } from "../middleware/errorHandler.ts";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// TRUST PENALTY CURVE — CONFIRMED 2026-06-23 ("Forgiving start"): forgiving while
// network data volume is low. The shape is what matters: no value is authoritative
// until corroborated, and a contributor's score drops ONLY when a conflict resolves
// against them. Revisit once VINs routinely get 3+ independent entries.
export const TRUST_CONFIG = {
  corroborateAt: 2, // N agreeing entries to trust a value
  resolveAt: 3, // total entries before a conflict resolves by majority
  minorityPenalty: 10, // score points removed per confirmed-wrong entry
  startScore: 100, // every account starts at 100%
  scoreFloor: 0,
};

export type ClaimOutcome =
  | { status: "recorded" } // first/early agreeing entry, nothing to decide yet
  | { status: "corroborated"; value: string } // enough agreement to trust the value
  | { status: "conflict_open"; flagId: string } // values disagree; waiting for more / tie
  | { status: "resolved"; flagId: string; value: string; penalized: number }; // majority decided

/**
 * recordFieldClaim — assert that VIN's `field` has `value`, per one contributor.
 *
 * State machine (see plan §4.2). NO entry is authoritative on its own; a score is
 * NEVER reduced on entry, only when a flag RESOLVES against the contributor. This
 * is what stops an honest correcter being punished by a wrong first entry.
 *
 * MUST run inside a `db.transaction`. Serialized per (vin, field) via advisory lock.
 */
export async function recordFieldClaim(tx: Tx, args: { vin: string; field: string; value: string; userId: string }): Promise<ClaimOutcome> {
  const { vin, field, value, userId } = args;

  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${vin + "|" + field})::bigint)`);

  // Is there already an unresolved flag for this (vin, field)?
  const [openFlag] = await tx
    .select({ id: data_flags.id })
    .from(data_flags)
    .where(and(eq(data_flags.vin, vin), eq(data_flags.field, field), sql`${data_flags.status} in ('open','corroborating')`))
    .limit(1);

  // Record the claim (linked to the open flag if one exists).
  await tx.insert(field_claims).values({ vin, field, value, userId, flagId: openFlag?.id ?? null });

  // Tally every claim ever made for this (vin, field).
  const claims = await tx.select({ value: field_claims.value, userId: field_claims.userId }).from(field_claims).where(and(eq(field_claims.vin, vin), eq(field_claims.field, field)));

  const counts = new Map<string, number>();
  for (const c of claims) counts.set(c.value, (counts.get(c.value) ?? 0) + 1);
  const distinctValues = [...counts.keys()];

  // --- Everyone agrees ------------------------------------------------------
  if (distinctValues.length === 1) {
    if (claims.length >= TRUST_CONFIG.corroborateAt) return { status: "corroborated", value };
    return { status: "recorded" };
  }

  // --- Values disagree → ensure an open flag, bump its entry count ----------
  let flagId = openFlag?.id;
  if (!flagId) {
    const inserted = await tx.insert(data_flags).values({ vin, field, status: "open", entriesCount: claims.length }).returning({ id: data_flags.id });
    flagId = inserted[0]?.id;
    if (!flagId) throw new AppError(500, "Failed to open data flag");
  } else {
    await tx.update(data_flags).set({ status: "corroborating", entriesCount: claims.length }).where(eq(data_flags.id, flagId));
  }

  // Not enough total entries to resolve yet → wait.
  if (claims.length < TRUST_CONFIG.resolveAt) return { status: "conflict_open", flagId };

  // --- Resolve by clear majority (a tie waits for more entries) -------------
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const second = sorted[1];
  if (!top) return { status: "conflict_open", flagId }; // unreachable; satisfies the type
  if (second && second[1] === top[1]) return { status: "conflict_open", flagId };

  const winningValue = top[0];
  let penalized = 0;
  for (const c of claims) {
    // Penalize the minority — ONCE, here, on resolution. Never on entry.
    if (c.value !== winningValue && c.userId) {
      await penalize(tx, c.userId, TRUST_CONFIG.minorityPenalty, flagId, `minority on "${field}" for VIN ${vin}`);
      penalized++;
    }
  }
  await tx.update(data_flags).set({ status: "resolved", resolvedValue: winningValue, resolvedAt: new Date() }).where(eq(data_flags.id, flagId));
  return { status: "resolved", flagId, value: winningValue, penalized };
}

/** Reduce a contributor's score (floored), with an audited adjustment row. */
async function penalize(tx: Tx, userId: string, points: number, flagId: string, reason: string): Promise<void> {
  await tx.insert(score_adjustments).values({ userId, delta: String(-points), reason, flagId });
  await tx
    .insert(contributor_scores)
    .values({ userId, score: String(Math.max(TRUST_CONFIG.scoreFloor, TRUST_CONFIG.startScore - points)) })
    .onConflictDoUpdate({
      target: contributor_scores.userId,
      set: { score: sql`greatest(${TRUST_CONFIG.scoreFloor}, ${contributor_scores.score} - ${points})`, updatedAt: new Date() },
    });
}

/** A contributor's current trust score (defaults to startScore if never adjusted). */
export async function getTrustScore(userId: string): Promise<number> {
  const [row] = await db.select({ score: contributor_scores.score }).from(contributor_scores).where(eq(contributor_scores.userId, userId)).limit(1);
  return row ? Number(row.score) : TRUST_CONFIG.startScore;
}
