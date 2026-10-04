CREATE TABLE "workspace_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"target_prospect" jsonb NOT NULL,
	"company_context" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
