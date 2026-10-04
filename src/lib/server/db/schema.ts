import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const iso = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "string" });

export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    fullName: text("full_name").notNull(),
    workEmail: text("work_email").notNull(),
    role: text("role"),
    source: text("source").notNull(),
    companyName: text("company_name").notNull(),
    domain: text("domain").notNull(),
    website: text("website").notNull(),
    industry: text("industry"),
    estimatedSize: text("estimated_size"),
    businessModel: text("business_model"),
    location: text("location"),
    status: text("status").notNull(),
    tier: text("tier").notNull(),
    score: integer("score").notNull().default(0),
    qualificationReasoning: text("qualification_reasoning").notNull().default(""),
    scoredAt: iso("scored_at"),
    summary: text("summary"),
    confidence: text("confidence").notNull().default("low"),
    workflowCurrentStage: text("workflow_current_stage")
      .notNull()
      .default("captured"),
    workflowAttempts: integer("workflow_attempts").notNull().default(0),
    processingDurationMs: integer("processing_duration_ms"),
    createdAt: iso("created_at").notNull(),
    updatedAt: iso("updated_at").notNull(),
    lastActivityAt: iso("last_activity_at").notNull(),
    idempotencyKey: text("idempotency_key"),
  },
  (table) => [
    uniqueIndex("leads_idempotency_key_uq").on(table.idempotencyKey),
    index("leads_status_idx").on(table.status),
    index("leads_tier_idx").on(table.tier),
    index("leads_score_idx").on(table.score),
    index("leads_last_activity_idx").on(table.lastActivityAt),
  ],
);

export const leadEvidence = pgTable(
  "lead_evidence",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    label: text("label").notNull(),
    detail: text("detail"),
    sourceUrl: text("source_url"),
    kind: text("kind").notNull(),
    confidence: text("confidence").notNull(),
    createdAt: iso("created_at").notNull(),
  },
  (table) => [index("lead_evidence_lead_idx").on(table.leadId)],
);

export const leadPainPoints = pgTable(
  "lead_pain_points",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("lead_pain_points_lead_idx").on(table.leadId)],
);

export const leadTechnologies = pgTable(
  "lead_technologies",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceEvidenceId: text("source_evidence_id"),
  },
  (table) => [index("lead_technologies_lead_idx").on(table.leadId)],
);

export const leadScores = pgTable(
  "lead_scores",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    criterionKey: text("criterion_key").notNull(),
    score: integer("score").notNull(),
    max: integer("max").notNull(),
    rationale: text("rationale").notNull(),
    scoredAt: iso("scored_at"),
    modelVersion: text("model_version"),
    rubricVersion: text("rubric_version"),
  },
  (table) => [index("lead_scores_lead_idx").on(table.leadId)],
);

export const leadRiskFlags = pgTable(
  "lead_risk_flags",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    severity: text("severity").notNull(),
    resolvedAt: iso("resolved_at"),
  },
  (table) => [index("lead_risk_flags_lead_idx").on(table.leadId)],
);

export const outreachDrafts = pgTable(
  "outreach_drafts",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    status: text("status").notNull().default("DRAFT"),
    version: integer("version").notNull().default(0),
    approvedBy: text("approved_by"),
    approvedAt: iso("approved_at"),
    createdAt: iso("created_at").notNull(),
    updatedAt: iso("updated_at").notNull(),
  },
  (table) => [uniqueIndex("outreach_drafts_lead_uq").on(table.leadId)],
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    providerRunId: text("provider_run_id"),
    status: text("status").notNull(),
    attempt: integer("attempt").notNull().default(0),
    startedAt: iso("started_at"),
    completedAt: iso("completed_at"),
    durationMs: integer("duration_ms"),
  },
  (table) => [index("workflow_runs_lead_idx").on(table.leadId)],
);

export const workflowSteps = pgTable(
  "workflow_steps",
  {
    id: text("id").primaryKey(),
    workflowRunId: text("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    stepKey: text("step_key").notNull(),
    status: text("status").notNull(),
    attempt: integer("attempt").notNull().default(0),
    startedAt: iso("started_at"),
    completedAt: iso("completed_at"),
    durationMs: integer("duration_ms"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
  },
  (table) => [index("workflow_steps_run_idx").on(table.workflowRunId)],
);

export const activityEvents = pgTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id"),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    metadataJson: jsonb("metadata_json"),
    occurredAt: iso("occurred_at").notNull(),
  },
  (table) => [
    index("activity_events_occurred_idx").on(table.occurredAt),
    index("activity_events_lead_idx").on(table.leadId),
  ],
);

export type LeadRow = typeof leads.$inferSelect;

export const workspaceSettings = pgTable("workspace_settings", {
  id: text("id").primaryKey(),
  targetProspect: jsonb("target_prospect").notNull(),
  companyContext: jsonb("company_context").notNull(),
  emailConfig: jsonb("email_config"),
  webhookConfig: jsonb("webhook_config"),
  updatedAt: iso("updated_at").notNull(),
});

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull(),
    providerMessageId: text("provider_message_id"),
    errorCode: text("error_code"),
    createdAt: iso("created_at").notNull(),
    updatedAt: iso("updated_at").notNull(),
  },
  (table) => [
    index("email_deliveries_lead_idx").on(table.leadId),
    index("email_deliveries_created_idx").on(table.createdAt),
  ],
);
