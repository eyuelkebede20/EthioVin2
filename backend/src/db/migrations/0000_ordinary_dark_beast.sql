CREATE TYPE "public"."body_style" AS ENUM('sedan', 'suv', 'hatchback', 'single_cab', 'double_cab', 'minivan', 'van', 'truck');--> statement-breakpoint
CREATE TYPE "public"."fuel" AS ENUM('petrol', 'diesel', 'hybrid', 'electric');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('pending', 'verified', 'rejected', 'conflict');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('manual', 'automatic', 'cvt');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'garage_admin', 'diagnostician', 'insurance', 'user');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nhtsa_models" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nhtsa_models_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"make" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"impersonatedBy" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean NOT NULL,
	"image" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"banned" boolean,
	"banReason" text,
	"banExpires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vds_cache" (
	"wmi" varchar(3) NOT NULL,
	"vds_code" varchar(6) NOT NULL,
	"spec_id" integer NOT NULL,
	"status" "status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vds_cache_wmi_vds_code_pk" PRIMARY KEY("wmi","vds_code")
);
--> statement-breakpoint
CREATE TABLE "vehicle_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"vin" varchar(17) NOT NULL,
	"manufacturer" text NOT NULL,
	"year" text NOT NULL,
	"model" text NOT NULL,
	"image_url" text,
	"wmi" text,
	"vds" text,
	"vis" text,
	"plant" text,
	"country" text,
	"hardware_specs" jsonb NOT NULL,
	"scannedBy" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_ledger_vin_unique" UNIQUE("vin")
);
--> statement-breakpoint
CREATE TABLE "vehicle_specs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicle_specs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hardware_specs" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp,
	"updatedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "verification_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "verification_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"wmi" varchar(3) NOT NULL,
	"vds_code" varchar(5) NOT NULL,
	"proposed_spec_id" integer NOT NULL,
	"admin_id" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wmi_mapping" (
	"wmi" varchar(3) PRIMARY KEY NOT NULL,
	"manufacturer" varchar(100) DEFAULT 'Unknown' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vds_cache" ADD CONSTRAINT "vds_cache_wmi_wmi_mapping_wmi_fk" FOREIGN KEY ("wmi") REFERENCES "public"."wmi_mapping"("wmi") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vds_cache" ADD CONSTRAINT "vds_cache_spec_id_vehicle_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."vehicle_specs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_ledger" ADD CONSTRAINT "vehicle_ledger_scannedBy_user_id_fk" FOREIGN KEY ("scannedBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_log" ADD CONSTRAINT "verification_log_proposed_spec_id_vehicle_specs_id_fk" FOREIGN KEY ("proposed_spec_id") REFERENCES "public"."vehicle_specs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_log" ADD CONSTRAINT "verification_log_wmi_vds_code_vds_cache_wmi_vds_code_fk" FOREIGN KEY ("wmi","vds_code") REFERENCES "public"."vds_cache"("wmi","vds_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wmi_vds_search_idx" ON "vds_cache" USING btree ("wmi","vds_code");--> statement-breakpoint
CREATE INDEX "vin_search_idx" ON "vehicle_ledger" USING btree ("vin");