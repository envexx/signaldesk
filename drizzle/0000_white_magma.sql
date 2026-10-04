CREATE TABLE "activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"metadata_json" jsonb,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"label" text NOT NULL,
	"detail" text,
	"source_url" text,
	"kind" text NOT NULL,
	"confidence" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_pain_points" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"content" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_risk_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"severity" text NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lead_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"criterion_key" text NOT NULL,
	"score" integer NOT NULL,
	"max" integer NOT NULL,
	"rationale" text NOT NULL,
	"scored_at" timestamp with time zone,
	"model_version" text,
	"rubric_version" text
);
--> statement-breakpoint
CREATE TABLE "lead_technologies" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"name" text NOT NULL,
	"source_evidence_id" text
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"work_email" text NOT NULL,
	"role" text,
	"source" text NOT NULL,
	"company_name" text NOT NULL,
	"domain" text NOT NULL,
	"website" text NOT NULL,
	"industry" text,
	"estimated_size" text,
	"business_model" text,
	"location" text,
	"status" text NOT NULL,
	"tier" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"qualification_reasoning" text DEFAULT '' NOT NULL,
	"scored_at" timestamp with time zone,
	"summary" text,
	"confidence" text DEFAULT 'low' NOT NULL,
	"workflow_current_stage" text DEFAULT 'captured' NOT NULL,
	"workflow_attempts" integer DEFAULT 0 NOT NULL,
	"processing_duration_ms" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"last_activity_at" timestamp with time zone NOT NULL,
	"idempotency_key" text
);
--> statement-breakpoint
CREATE TABLE "outreach_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"provider_run_id" text,
	"status" text NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_run_id" text NOT NULL,
	"step_key" text NOT NULL,
	"status" text NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"error_code" text,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "lead_evidence" ADD CONSTRAINT "lead_evidence_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_pain_points" ADD CONSTRAINT "lead_pain_points_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_risk_flags" ADD CONSTRAINT "lead_risk_flags_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_technologies" ADD CONSTRAINT "lead_technologies_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_drafts" ADD CONSTRAINT "outreach_drafts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_run_id_workflow_runs_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_occurred_idx" ON "activity_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "activity_events_lead_idx" ON "activity_events" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_evidence_lead_idx" ON "lead_evidence" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_pain_points_lead_idx" ON "lead_pain_points" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_risk_flags_lead_idx" ON "lead_risk_flags" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_scores_lead_idx" ON "lead_scores" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_technologies_lead_idx" ON "lead_technologies" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_idempotency_key_uq" ON "leads" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_tier_idx" ON "leads" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "leads_score_idx" ON "leads" USING btree ("score");--> statement-breakpoint
CREATE INDEX "leads_last_activity_idx" ON "leads" USING btree ("last_activity_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_drafts_lead_uq" ON "outreach_drafts" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "workflow_runs_lead_idx" ON "workflow_runs" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "workflow_steps_run_idx" ON "workflow_steps" USING btree ("workflow_run_id");