CREATE TABLE "nhtsa_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"make" varchar(50) NOT NULL,
	"model" varchar(50) NOT NULL,
	"model_year" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_nhtsa_make_year" ON "nhtsa_models" USING btree ("make","model_year");