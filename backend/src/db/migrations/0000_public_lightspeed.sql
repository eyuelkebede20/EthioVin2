CREATE TYPE "public"."body_style" AS ENUM('sedan', 'suv', 'hatchback', 'single_cab', 'double_cab', 'minivan', 'van', 'truck');--> statement-breakpoint
CREATE TYPE "public"."fuel" AS ENUM('petrol', 'diesel', 'hybrid', 'electric');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('pending', 'verified', 'rejected', 'conflict');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('manual', 'automatic', 'cvt');--> statement-breakpoint
CREATE TABLE "nhtsa_models" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nhtsa_models_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"make" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vds_cache" (
	"wmi" varchar(3) NOT NULL,
	"vds_code" varchar(5) NOT NULL,
	"spec_id" integer NOT NULL,
	"status" "status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vds_cache_wmi_vds_code_pk" PRIMARY KEY("wmi","vds_code")
);
--> statement-breakpoint
CREATE TABLE "vehicle_specs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicle_specs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"model_id" integer NOT NULL,
	"year" integer NOT NULL,
	"engine_cc" integer NOT NULL,
	"fuel" "fuel" NOT NULL,
	"transmission" "transmission" NOT NULL,
	"body_style" "body_style" NOT NULL
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
ALTER TABLE "vds_cache" ADD CONSTRAINT "vds_cache_wmi_wmi_mapping_wmi_fk" FOREIGN KEY ("wmi") REFERENCES "public"."wmi_mapping"("wmi") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vds_cache" ADD CONSTRAINT "vds_cache_spec_id_vehicle_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."vehicle_specs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_specs" ADD CONSTRAINT "vehicle_specs_model_id_nhtsa_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."nhtsa_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_log" ADD CONSTRAINT "verification_log_proposed_spec_id_vehicle_specs_id_fk" FOREIGN KEY ("proposed_spec_id") REFERENCES "public"."vehicle_specs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_log" ADD CONSTRAINT "verification_log_wmi_vds_code_vds_cache_wmi_vds_code_fk" FOREIGN KEY ("wmi","vds_code") REFERENCES "public"."vds_cache"("wmi","vds_code") ON DELETE no action ON UPDATE no action;