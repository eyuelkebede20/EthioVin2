DROP INDEX "wmi_vds_search_idx";--> statement-breakpoint
DROP INDEX "vin_search_idx";--> statement-breakpoint
ALTER TABLE "vds_cache" ALTER COLUMN "vds_code" SET DATA TYPE varchar(5);--> statement-breakpoint
ALTER TABLE "verification_log" ALTER COLUMN "admin_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "vehicle_ledger" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "wmi_mapping" ADD COLUMN "country" varchar(100);--> statement-breakpoint
ALTER TABLE "wmi_mapping" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_log" ADD CONSTRAINT "verification_log_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nhtsa_make_idx" ON "nhtsa_models" USING btree ("make");