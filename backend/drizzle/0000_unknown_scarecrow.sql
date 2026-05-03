CREATE TYPE "public"."body_class" AS ENUM('Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Wagon');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('Petrol', 'Diesel', 'Electric', 'Hybrid');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('Manual', 'Automatic', 'CVT', 'DCT');--> statement-breakpoint
CREATE TABLE "jdm_cache" (
	"frame_model_code" varchar(20) PRIMARY KEY NOT NULL,
	"make" varchar(50) NOT NULL,
	"model" varchar(50) NOT NULL,
	"engine_cc" integer,
	"fuel_type" "fuel_type" NOT NULL,
	"transmission" "transmission" NOT NULL,
	"body_class" "body_class" NOT NULL,
	"added_by_admin_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vds_cache" (
	"vds_code" varchar(6) PRIMARY KEY NOT NULL,
	"wmi_code" varchar(3) NOT NULL,
	"make" varchar(50) NOT NULL,
	"model" varchar(50) NOT NULL,
	"model_year" integer NOT NULL,
	"engine_cc" integer,
	"fuel_type" "fuel_type" NOT NULL,
	"transmission" "transmission" NOT NULL,
	"body_class" "body_class" NOT NULL,
	"trim_level" varchar(50),
	"source_document" varchar(50),
	"added_by_admin_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_make_model_year" ON "vds_cache" USING btree ("make","model","model_year");