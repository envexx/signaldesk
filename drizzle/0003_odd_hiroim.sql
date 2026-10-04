CREATE TABLE "email_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error_code" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_deliveries_lead_idx" ON "email_deliveries" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "email_deliveries_created_idx" ON "email_deliveries" USING btree ("created_at");