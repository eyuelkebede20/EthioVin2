-- M2 schema bootstrap — IDEMPOTENT, safe to re-run.
-- Generated from migration 0003 (the full M2 additive schema) but rewritten so
-- every statement is a no-op if the object already exists (CREATE TABLE/INDEX IF
-- NOT EXISTS, guarded CREATE TYPE, pg_constraint-checked FKs). Use this to apply
-- M2 to a prod DB regardless of whether a dev db:push already created some tables.
-- Apply:  psql "$DATABASE_URL" -f src/db/m2.sql

BEGIN;

DO $$ BEGIN
  CREATE TYPE "public"."agreement_status" AS ENUM('active', 'revoked');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."credit_reason" AS ENUM('data_input', 'verification', 'referral', 'redemption', 'penalty', 'exchange');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."event_status" AS ENUM('active', 'flagged', 'disputed', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."event_type" AS ENUM('inspection', 'repair', 'maintenance', 'odometer', 'ownership', 'insurance_claim', 'police_report', 'accident');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."flag_status" AS ENUM('open', 'corroborating', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."job_status" AS ENUM('intake', 'in_progress', 'awaiting_parts', 'done', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."org_type" AS ENUM('garage', 'insurer', 'diagnostic');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."tier" AS ENUM('free', 'premium');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appointments" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"vin" varchar(17),
	"customer_id" text,
	"scheduled_at" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"action" varchar(80) NOT NULL,
	"resource_type" varchar(60),
	"resource_id" text,
	"org_id" text,
	"ip" varchar(60),
	"user_agent" text,
	"metadata" jsonb,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contributor_scores" (
	"user_id" text PRIMARY KEY NOT NULL,
	"score" numeric(5, 2) DEFAULT '100.00' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"delta" numeric(12, 2) NOT NULL,
	"reason" "credit_reason" NOT NULL,
	"event_id" text,
	"balance_after" numeric(14, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" varchar(200) NOT NULL,
	"phone" varchar(40),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"vin" varchar(17) NOT NULL,
	"field" varchar(60) NOT NULL,
	"status" "flag_status" DEFAULT 'open' NOT NULL,
	"entries_count" integer DEFAULT 1 NOT NULL,
	"resolved_value" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_sharing_agreements" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"scope" jsonb NOT NULL,
	"accepted_by" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"status" "agreement_status" DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "field_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"vin" varchar(17) NOT NULL,
	"field" varchar(60) NOT NULL,
	"value" text NOT NULL,
	"user_id" text,
	"flag_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "garage_job_items" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"kind" varchar(20) NOT NULL,
	"description" varchar(300) NOT NULL,
	"qty" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "garage_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"vin" varchar(17),
	"customer_id" text,
	"status" "job_status" DEFAULT 'intake' NOT NULL,
	"odometer_in" integer,
	"total_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "insurance_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"vin" varchar(17) NOT NULL,
	"incident_type" varchar(40) NOT NULL,
	"severity_band" integer NOT NULL,
	"incident_date" timestamp,
	"payout_band" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "odometer_readings" (
	"id" text PRIMARY KEY NOT NULL,
	"vin" varchar(17) NOT NULL,
	"reading_km" integer NOT NULL,
	"read_at" timestamp,
	"source" varchar(40),
	"recorded_by" text,
	"org_id" text,
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"org_role" varchar(40) DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" "org_type" NOT NULL,
	"country" varchar(100),
	"city" varchar(100),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parts" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" varchar(200) NOT NULL,
	"sku" varchar(80),
	"qty_on_hand" integer DEFAULT 0 NOT NULL,
	"reorder_level" integer DEFAULT 0 NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(8) DEFAULT 'ETB' NOT NULL,
	"provider" varchar(40),
	"provider_ref" varchar(200),
	"idempotency_key" varchar(200),
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "police_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"vin" varchar(17) NOT NULL,
	"report_ref" varchar(100),
	"incident_type" varchar(40) NOT NULL,
	"severity_band" integer,
	"incident_date" timestamp,
	"source_org_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "premium_access" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tier" "tier" DEFAULT 'free' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "score_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"delta" numeric(6, 2) NOT NULL,
	"reason" varchar(120) NOT NULL,
	"flag_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_events" (
	"id" text PRIMARY KEY NOT NULL,
	"vin" varchar(17) NOT NULL,
	"event_type" "event_type" NOT NULL,
	"occurred_at" timestamp,
	"recorded_by" text,
	"org_id" text,
	"source_type" varchar(40),
	"payload" jsonb NOT NULL,
	"trust_weight" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"status" "event_status" DEFAULT 'active' NOT NULL,
	"credit_awarded" numeric(12, 2) DEFAULT '0' NOT NULL,
	"idempotency_key" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_org_id_organizations_id_fk') THEN
    ALTER TABLE "appointments" ADD CONSTRAINT "appointments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_customer_id_customers_id_fk') THEN
    ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_log_actor_user_id_user_id_fk') THEN
    ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contributor_scores_user_id_user_id_fk') THEN
    ALTER TABLE "contributor_scores" ADD CONSTRAINT "contributor_scores_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_ledger_user_id_user_id_fk') THEN
    ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_org_id_organizations_id_fk') THEN
    ALTER TABLE "customers" ADD CONSTRAINT "customers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_sharing_agreements_org_id_organizations_id_fk') THEN
    ALTER TABLE "data_sharing_agreements" ADD CONSTRAINT "data_sharing_agreements_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_sharing_agreements_accepted_by_user_id_fk') THEN
    ALTER TABLE "data_sharing_agreements" ADD CONSTRAINT "data_sharing_agreements_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'field_claims_user_id_user_id_fk') THEN
    ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'field_claims_flag_id_data_flags_id_fk') THEN
    ALTER TABLE "field_claims" ADD CONSTRAINT "field_claims_flag_id_data_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."data_flags"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garage_job_items_job_id_garage_jobs_id_fk') THEN
    ALTER TABLE "garage_job_items" ADD CONSTRAINT "garage_job_items_job_id_garage_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."garage_jobs"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garage_jobs_org_id_organizations_id_fk') THEN
    ALTER TABLE "garage_jobs" ADD CONSTRAINT "garage_jobs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garage_jobs_customer_id_customers_id_fk') THEN
    ALTER TABLE "garage_jobs" ADD CONSTRAINT "garage_jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garage_jobs_created_by_user_id_fk') THEN
    ALTER TABLE "garage_jobs" ADD CONSTRAINT "garage_jobs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'insurance_claims_org_id_organizations_id_fk') THEN
    ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'odometer_readings_recorded_by_user_id_fk') THEN
    ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'odometer_readings_org_id_organizations_id_fk') THEN
    ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_org_id_organizations_id_fk') THEN
    ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_user_id_user_id_fk') THEN
    ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parts_org_id_organizations_id_fk') THEN
    ALTER TABLE "parts" ADD CONSTRAINT "parts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_user_id_user_id_fk') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'police_reports_source_org_id_organizations_id_fk') THEN
    ALTER TABLE "police_reports" ADD CONSTRAINT "police_reports_source_org_id_organizations_id_fk" FOREIGN KEY ("source_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'premium_access_user_id_user_id_fk') THEN
    ALTER TABLE "premium_access" ADD CONSTRAINT "premium_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'score_adjustments_user_id_user_id_fk') THEN
    ALTER TABLE "score_adjustments" ADD CONSTRAINT "score_adjustments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'score_adjustments_flag_id_data_flags_id_fk') THEN
    ALTER TABLE "score_adjustments" ADD CONSTRAINT "score_adjustments_flag_id_data_flags_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."data_flags"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_events_recorded_by_user_id_fk') THEN
    ALTER TABLE "vehicle_events" ADD CONSTRAINT "vehicle_events_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_events_org_id_organizations_id_fk') THEN
    ALTER TABLE "vehicle_events" ADD CONSTRAINT "vehicle_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appts_org_idx" ON "appointments" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_actor_idx" ON "audit_log" USING btree ("actor_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_resource_idx" ON "audit_log" USING btree ("resource_type","resource_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_user_idx" ON "credit_ledger" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_org_idx" ON "customers" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flags_vin_field_idx" ON "data_flags" USING btree ("vin","field","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dsa_org_idx" ON "data_sharing_agreements" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_claims_vin_field_idx" ON "field_claims" USING btree ("vin","field");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_items_job_idx" ON "garage_job_items" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_org_status_idx" ON "garage_jobs" USING btree ("org_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_vin_idx" ON "garage_jobs" USING btree ("vin");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claims_org_date_idx" ON "insurance_claims" USING btree ("org_id","incident_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "claims_vin_idx" ON "insurance_claims" USING btree ("vin");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "odo_vin_idx" ON "odometer_readings" USING btree ("vin");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_members_org_idx" ON "organization_members" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_members_user_idx" ON "organization_members" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parts_org_idx" ON "parts" USING btree ("org_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_user_idx" ON "payments" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "police_vin_idx" ON "police_reports" USING btree ("vin");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "premium_user_idx" ON "premium_access" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "score_adj_user_idx" ON "score_adjustments" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_vin_idx" ON "vehicle_events" USING btree ("vin");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_vin_type_idx" ON "vehicle_events" USING btree ("vin","event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_recorded_by_idx" ON "vehicle_events" USING btree ("recorded_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_occurred_idx" ON "vehicle_events" USING btree ("occurred_at");

COMMIT;
