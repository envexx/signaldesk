export type LeadTier =
  | "HIGH_PRIORITY"
  | "MEDIUM"
  | "DISQUALIFIED"
  | "UNASSESSED";

export type LeadStatus =
  | "CAPTURED"
  | "PROCESSING"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "SENT"
  | "FAILED";

export type WorkflowStepStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "SKIPPED";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface Evidence {
  id: string;
  label: string;
  url?: string;
  sourceType: "WEBSITE" | "AI_INFERENCE" | "FORM_INPUT";
  confidence: Confidence;
}

export interface WorkflowStep {
  id: string;
  title: string;
  status: WorkflowStepStatus;
  timestamp?: string;
  durationMs?: number;
  detail: string;
}

export interface Lead {
  id: string;
  fullName: string;
  initials: string;
  workEmail: string;
  role: string;
  source: string;
  company: {
    name: string;
    domain: string;
    website: string;
    industry: string;
    estimatedSize: string;
    businessModel: string;
    location: string;
    summary: string;
    technologies: string[];
  };
  qualification: {
    score: number;
    tier: LeadTier;
    reasoning: string;
    criteria: {
      companyFit: number;
      problemFit: number;
      buyingSignal: number;
      dataConfidence: number;
    };
    riskFlags: string[];
  };
  enrichment: {
    painPoints: string[];
    evidence: Evidence[];
    confidence: Confidence;
  };
  draft: {
    subject: string;
    body: string;
    status: "DRAFT" | "APPROVED" | "SENT" | "REJECTED";
    /** Canonical draft version, used for optimistic approval. */
    version?: number;
    lastEditedAt: string;
  };
  workflow: WorkflowStep[];
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
  processingDurationMs?: number;
}

export interface NewLeadInput {
  fullName: string;
  workEmail: string;
  companyWebsite: string;
  role?: string;
}

export const tierLabels: Record<LeadTier, string> = {
  HIGH_PRIORITY: "High priority",
  MEDIUM: "Medium fit",
  DISQUALIFIED: "Disqualified",
  UNASSESSED: "Unassessed",
};

export const statusLabels: Record<LeadStatus, string> = {
  CAPTURED: "Captured",
  PROCESSING: "Processing",
  READY_FOR_REVIEW: "Ready for review",
  APPROVED: "Approved",
  SENT: "Sent",
  FAILED: "Needs attention",
};

