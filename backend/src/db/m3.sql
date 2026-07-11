-- M3 schema bootstrap — IDEMPOTENT, safe to re-run.
-- The public API platform's six additive tables + four enums (see
-- claude.milestone3.md §3). Every statement is a no-op if the object already
-- exists (guarded CREATE TYPE, CREATE TABLE/INDEX IF NOT EXISTS,
-- pg_constraint-checked FKs), mirroring m2.sql. Zero changes to existing tables.
-- Apply:  psql "$DATABASE_URL" -f src/db/m3.sql

BEGIN;

-- ---- enums --------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "public"."api_key_status" AS ENUM('active', 'revoked');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."api_request_result" AS ENUM('exact', 'model', 'parse_only', 'invalid', 'error');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."promo_status" AS ENUM('active', 'disabled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."purchase_status" AS ENUM('pending', 'paid', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- ---- api_key ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "api_key" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" text NOT NULL,
  "name" varchar(64) NOT NULL,
  "key_prefix" varchar(16) NOT NULL,
  "key_hash" varchar(64) NOT NULL,
  "last4" varchar(4) NOT NULL,
  "rate_limit_per_min" integer DEFAULT 10 NOT NULL,
  "status" "api_key_status" DEFAULT 'active' NOT NULL,
  "last_used_at" timestamp,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp,
  CONSTRAINT "api_key_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint

-- ---- api_request_log ----------------------------------------------------
CREATE TABLE IF NOT EXISTS "api_request_log" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "request_id" varchar(24) NOT NULL,
  "api_key_id" uuid NOT NULL,
  "endpoint" varchar(64) NOT NULL,
  "vin" varchar(17),
  "result" "api_request_result" NOT NULL,
  "credits_charged" integer DEFAULT 0 NOT NULL,
  "http_status" integer NOT NULL,
  "latency_ms" integer,
  "ip" varchar(45),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_log_key_time" ON "api_request_log" ("api_key_id", "created_at");
--> statement-breakpoint

-- ---- api_idempotency ----------------------------------------------------
CREATE TABLE IF NOT EXISTS "api_idempotency" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "api_key_id" uuid NOT NULL,
  "idem_key" varchar(64) NOT NULL,
  "request_hash" varchar(64) NOT NULL,
  "http_status" integer NOT NULL,
  "response" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uq_idem_key" UNIQUE("api_key_id", "idem_key")
);
--> statement-breakpoint

-- ---- promo_code ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "promo_code" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(32) NOT NULL,
  "credits" integer NOT NULL,
  "max_redemptions" integer,
  "redeemed_count" integer DEFAULT 0 NOT NULL,
  "per_account_limit" integer DEFAULT 1 NOT NULL,
  "starts_at" timestamp,
  "expires_at" timestamp,
  "status" "promo_status" DEFAULT 'active' NOT NULL,
  "created_by" text,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "promo_code_code_unique" UNIQUE("code")
);
--> statement-breakpoint

-- ---- promo_redemption ---------------------------------------------------
CREATE TABLE IF NOT EXISTS "promo_redemption" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "promo_code_id" uuid NOT NULL,
  "owner_id" text NOT NULL,
  "credited" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "uq_promo_owner" UNIQUE("promo_code_id", "owner_id")
);
--> statement-breakpoint

-- ---- credit_purchase ----------------------------------------------------
CREATE TABLE IF NOT EXISTS "credit_purchase" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" text NOT NULL,
  "pack_id" varchar(32) NOT NULL,
  "credits" integer NOT NULL,
  "amount_etb" numeric(10, 2) NOT NULL,
  "chapa_tx_ref" varchar(64) NOT NULL,
  "status" "purchase_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "paid_at" timestamp,
  CONSTRAINT "credit_purchase_chapa_tx_ref_unique" UNIQUE("chapa_tx_ref")
);
--> statement-breakpoint

-- ---- foreign keys (guarded — added only if absent) ----------------------
DO $$ BEGIN
  ALTER TABLE "api_key" ADD CONSTRAINT "api_key_owner_id_user_id_fk"
    FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "api_request_log" ADD CONSTRAINT "api_request_log_api_key_id_api_key_id_fk"
    FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "api_idempotency" ADD CONSTRAINT "api_idempotency_api_key_id_api_key_id_fk"
    FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_created_by_user_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."user"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promo_redemption" ADD CONSTRAINT "promo_redemption_promo_code_id_promo_code_id_fk"
    FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_code"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "promo_redemption" ADD CONSTRAINT "promo_redemption_owner_id_user_id_fk"
    FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_purchase" ADD CONSTRAINT "credit_purchase_owner_id_user_id_fk"
    FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

COMMIT;
