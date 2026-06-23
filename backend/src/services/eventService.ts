import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { vehicle_events, contributor_scores } from "../db/schema.ts";
import { parseVin } from "../utils/vin.ts";
import { recordCredit } from "./creditService.ts";
import { recordFieldClaim, TRUST_CONFIG, type ClaimOutcome } from "./trustService.ts";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type EventType = "inspection" | "repair" | "maintenance" | "odometer" | "ownership" | "insurance_claim" | "police_report" | "accident";

// Base credit for one accepted data input, before trust weighting.
const BASE_CREDIT = 10;

export interface IngestArgs {
  vin: string;
  eventType: EventType;
  payload: Record<string, unknown>;
  occurredAt?: Date | undefined;
  recordedBy?: string | undefined; // user id of the contributor (drives credit + trust)
  orgId?: string | undefined;
  sourceType?: string | undefined;
  // Field values this event asserts about the vehicle (e.g. {field:"color",value:"white"}).
  // Each runs through the corroboration engine (trust changes only on resolution).
  fields?: Array<{ field: string; value: string | number }> | undefined;
  // Override the derived dedup key (e.g. garage passes a job-based key).
  idempotencyKey?: string | undefined;
}

export interface IngestResult {
  duplicate: boolean;
  eventId?: string;
  creditAwarded?: number;
  trustWeight?: number;
  corroboration?: Array<{ field: string; outcome: ClaimOutcome }>;
}

/**
 * ingestVehicleEvent — the shared spine write path for every contributor input
 * (garage job close, odometer reading, insurance/police signal, diagnostician
 * inspection). MUST run inside a db.transaction (pass `tx`); reads the trust
 * score via `tx` (NOT db) so it can't deadlock the single-connection pool.
 *
 * Steps, all atomic:
 *   1. derive the canonical VIN on the server (parseVin)
 *   2. insert the vehicle_event with an idempotency key — a duplicate submit is a
 *      no-op (onConflictDoNothing), so it can NEVER award credit twice
 *   3. award trust-weighted credit to the contributor (reason "data_input")
 *   4. run corroboration for each asserted field (may open/resolve a data_flag)
 */
export async function ingestVehicleEvent(tx: Tx, args: IngestArgs): Promise<IngestResult> {
  const { eventType, payload, occurredAt, recordedBy, orgId, sourceType, fields } = args;
  const { keyVin } = parseVin(args.vin);

  const idempotencyKey =
    args.idempotencyKey ??
    createHash("sha256")
      .update([orgId ?? "", keyVin, eventType, occurredAt ? occurredAt.toISOString() : ""].join("|"))
      .digest("hex");

  const inserted = await tx
    .insert(vehicle_events)
    .values({
      vin: keyVin,
      eventType,
      occurredAt: occurredAt ?? null,
      recordedBy: recordedBy ?? null,
      orgId: orgId ?? null,
      sourceType: sourceType ?? null,
      payload,
      idempotencyKey,
      trustWeight: "1.00",
      creditAwarded: "0",
    })
    .onConflictDoNothing({ target: vehicle_events.idempotencyKey })
    .returning({ id: vehicle_events.id });

  const eventId = inserted[0]?.id;
  if (!eventId) return { duplicate: true }; // already ingested — no double credit

  // Trust-weighted credit. Read the contributor's score via tx (single-pool safe).
  let creditAwarded = 0;
  let trustWeight = 1;
  if (recordedBy) {
    const [scoreRow] = await tx.select({ score: contributor_scores.score }).from(contributor_scores).where(eq(contributor_scores.userId, recordedBy)).limit(1);
    const score = scoreRow ? Number(scoreRow.score) : TRUST_CONFIG.startScore;
    trustWeight = score / 100;
    creditAwarded = Math.round(BASE_CREDIT * trustWeight * 100) / 100;
    await tx.update(vehicle_events).set({ trustWeight: trustWeight.toFixed(2), creditAwarded: String(creditAwarded) }).where(eq(vehicle_events.id, eventId));
    await recordCredit(tx, { userId: recordedBy, delta: creditAwarded, reason: "data_input", eventId });
  }

  // Corroboration for each asserted field (trust changes only on resolution).
  const corroboration: Array<{ field: string; outcome: ClaimOutcome }> = [];
  if (fields && recordedBy) {
    for (const { field, value } of fields) {
      const outcome = await recordFieldClaim(tx, { vin: keyVin, field, value: String(value), userId: recordedBy });
      corroboration.push({ field, outcome });
    }
  }

  return { duplicate: false, eventId, creditAwarded, trustWeight, corroboration };
}

/** Standalone convenience: ingest one event in its own transaction. */
export function recordVehicleEvent(args: IngestArgs): Promise<IngestResult> {
  return db.transaction((tx) => ingestVehicleEvent(tx, args));
}
