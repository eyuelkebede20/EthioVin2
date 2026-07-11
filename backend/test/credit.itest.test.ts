import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { user, credit_ledger } from "../src/db/schema.ts";
import * as creditBridge from "../src/services/creditBridge.ts";
import { InsufficientCreditsError } from "../src/services/creditBridge.ts";
import { nano } from "../src/utils/id.ts";

// Money-safety integration tests (failure registry #3 wallet race, #4/#5 charge law
// via the bridge). These WRITE to the database, so they are OFF unless RUN_DB_TESTS=1
// — never run them against production. They create a throwaway user and clean it up.

const enabled = !!process.env.RUN_DB_TESTS;
const opts = { skip: enabled ? false : "set RUN_DB_TESTS=1 to run DB integration tests" };

const uid = "test_" + nano(16);

before(async () => {
  if (!enabled) return;
  const now = new Date();
  await db.insert(user).values({
    id: uid,
    name: "Credit Test",
    email: `${uid}@test.local`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    role: "user",
  });
});

after(async () => {
  if (!enabled) return;
  await db.delete(credit_ledger).where(eq(credit_ledger.userId, uid));
  await db.delete(user).where(eq(user.id, uid));
});

test("grant then balance reflects the running total", opts, async () => {
  const { balance } = await creditBridge.grant({ ownerId: uid, amount: 5, source: "signup_grant", ref: "signup:" + uid });
  assert.equal(balance, 5);
  assert.equal(await creditBridge.balance(uid), 5);
});

test("charge decrements and refuses to go negative", opts, async () => {
  await creditBridge.charge({ ownerId: uid, amount: 4, source: "api_decode", ref: "decode:" + nano(8) });
  assert.equal(await creditBridge.balance(uid), 1);
  await assert.rejects(
    () => creditBridge.charge({ ownerId: uid, amount: 2, source: "api_decode", ref: "decode:" + nano(8) }),
    InsufficientCreditsError,
    "over-charge is rejected, not allowed negative",
  );
  assert.equal(await creditBridge.balance(uid), 1, "balance unchanged after a failed charge");
});

test("concurrent charges on a 1-credit balance: exactly one succeeds (wallet race)", opts, async () => {
  // Balance is 1 from the prior test. Fire two concurrent 1-credit charges.
  const results = await Promise.allSettled([
    creditBridge.charge({ ownerId: uid, amount: 1, source: "api_decode", ref: "decode:" + nano(8) }),
    creditBridge.charge({ ownerId: uid, amount: 1, source: "api_decode", ref: "decode:" + nano(8) }),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  assert.equal(ok, 1, "exactly one charge succeeds");
  assert.equal(failed, 1, "the other is rejected");
  assert.equal(await creditBridge.balance(uid), 0, "balance lands at 0, never negative");
});

test("hasGrantRef detects an existing signup grant (idempotency guard)", opts, async () => {
  assert.equal(await creditBridge.hasGrantRef(uid, "signup:" + uid), true);
  assert.equal(await creditBridge.hasGrantRef(uid, "signup:nonexistent"), false);
});
