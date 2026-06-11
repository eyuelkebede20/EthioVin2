-- Idempotent schema adjustment.
-- Brings an EXISTING database up to the current schema. It does NOT create
-- tables, and is safe to run repeatedly: every statement is a no-op if the
-- change is already in place (so no "already exists" errors).

BEGIN;

-- 1. Drop legacy indexes that were replaced by the composite PK / unique.
DROP INDEX IF EXISTS "wmi_vds_search_idx";
DROP INDEX IF EXISTS "vin_search_idx";

-- 2. Columns newer code expects.
ALTER TABLE "wmi_mapping"    ADD COLUMN IF NOT EXISTS "country" varchar(100);
ALTER TABLE "wmi_mapping"    ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "vehicle_ledger" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now() NOT NULL;

-- 3. Column types (no-op if already correct).
ALTER TABLE "vds_cache"        ALTER COLUMN "vds_code" SET DATA TYPE varchar(5);
ALTER TABLE "verification_log" ALTER COLUMN "admin_id" SET DATA TYPE text USING "admin_id"::text;

-- 4. Index for the NHTSA make lookup.
CREATE INDEX IF NOT EXISTS "nhtsa_make_idx" ON "nhtsa_models" USING btree ("make");

-- 5. FK admin_id -> user.id (only if it doesn't already exist).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verification_log_admin_id_user_id_fk') THEN
    ALTER TABLE "verification_log"
      ADD CONSTRAINT "verification_log_admin_id_user_id_fk"
      FOREIGN KEY ("admin_id") REFERENCES "user"("id");
  END IF;
END $$;

COMMIT;
