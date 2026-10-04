/**
 * Canonical lead domain contract.
 *
 * This module is shared with the frontend: it contains only plain types and
 * constants (no runtime dependencies, no server code, no `Date` instances).
 * Every timestamp crosses the wire as an ISO string.
 */

export const TIERS = [
  "HIGH_PRIORITY",
  "MEDIUM",
  "DISQUALIFIED",
  "UNASSESSED",
] as const;

export type Tier = (typeof TIERS)[number];

export const LEAD_STATUSES = [
  "CAPTURED",
  "PROCESSING",
  "READY_FOR_REVIEW",
  "APPROVED",
  "SENT",
  "FAILED",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STEP_STATUSES = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "SKIPPED",
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

export const DRAFT_STATUSES = ["DRAFT", "APPROVED", "SENT", "REJECTED"] as const;

export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export type EvidenceKind = "source" | "inference";

export type RiskSeverity = "low" | "medium" | "high";

export type CriterionKey =
  | "companyFit"
  | "problemFit"
  | "buyingSignal"
  | "dataConfidence";

export const WORKFLOW_STEP_KEYS = [
  "captured",
  "validate",
  "research",
  "extract",
  "score",
  "draft",
  "review",
  "approve",
  "send",
] as const;

export type WorkflowStepKey = (typeof WORKFLOW_STEP_KEYS)[number];

/** Ordered human-readable workflow timeline used by the UI. */
export const WORKFLOW_STEP_LABELS: Record<WorkflowStepKey, string> = {
  captured: "Captured",
  validate: "Validated",
  research: "Website researched",
  extract: "Intelligence extracted",
  score: "Scored",
  draft: "Drafted",
  review: "Awaiting approval",
  approve: "Approved",
  send: "Sent",
};

export interface ContactIdentity {
  fullName: string;
  /** Normalized to lowercase. */
  workEmail: string;
  role: string | null;
  source: string;
}

export interface CompanyProfile {
  name: string;
  /** Canonical hostname without `www.`. */
  domain: string;
  /** Canonical `https://` origin. */
  website: string;
  industry: string | null;
  estimatedSize: string | null;
  businessModel: string | null;
  location: string | null;
}

export interface EvidenceItem {
  id: string;
  label: string;
  detail: string | null;
  sourceUrl: string | null;
  kind: EvidenceKind;
  confidence: ConfidenceLevel;
}

export interface ScoreCriterion {
  key: CriterionKey;
  label: string;
  score: number;
  max: number;
  rationale: string;
}

export interface RiskFlag {
  code: string;
  label: string;
  severity: RiskSeverity;
}

export interface Qualification {
  /** 0–100, computed by the backend, never taken from the LLM directly. */
  score: number;
  tier: Tier;
  reasoning: string;
  criteria: ScoreCriterion[];
  riskFlags: RiskFlag[];
  scoredAt: string | null;
}

export interface CompanyIntelligence {
  summary: string | null;
  painPoints: string[];
  technologies: string[];
  evidence: EvidenceItem[];
  confidence: ConfidenceLevel;
}

export interface OutreachDraft {
  subject: string;
  body: string;
  status: DraftStatus;
  /** Increments on every accepted edit. */
  version: number;
  lastEditedAt: string | null;
}

export interface WorkflowStep {
  key: WorkflowStepKey;
  name: string;
  status: StepStatus;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface WorkflowState {
  currentStage: WorkflowStepKey;
  steps: WorkflowStep[];
  /** Number of full orchestration runs for this lead. */
  attempts: number;
  processingDurationMs: number | null;
}

export interface Lead {
  id: string;
  contact: ContactIdentity;
  company: CompanyProfile;
  qualification: Qualification;
  enrichment: CompanyIntelligence;
  draft: OutreachDraft;
  workflow: WorkflowState;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  idempotencyKey: string | null;
}

/** Convenience alias describing the minimal lead payload used for creation. */
export interface CreateLeadInput {
  fullName: string;
  workEmail: string;
  companyWebsite: string;
  role?: string;
  companyName?: string;
  source?: string;
}

export interface UpdateLeadInput {
  fullName?: string;
  workEmail?: string;
  role?: string | null;
  source?: string;
  company?: Partial<
    Pick<CompanyProfile, "name" | "industry" | "estimatedSize" | "businessModel">
  >;
  draft?: {
    subject?: string;
    body?: string;
  };
}
