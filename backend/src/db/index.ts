import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

const connectionString = process.env.DATABASE_URL as string;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Pool size: M1/M2 ran max:1 (single internal tool). The public /v1 surface + the
// Chapa webhook add concurrent traffic on the same pool, so allow a modest default
// (5) — tune DB_POOL_MAX to the host's Postgres connection cap before launch (§5).
const poolMax = Number(process.env.DB_POOL_MAX ?? 5);
const client = postgres(connectionString, { max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 5 });

export const db = drizzle(client, { schema });
