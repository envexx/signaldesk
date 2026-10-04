/**
 * Map canonical backend contracts (`@/contracts`) to the UI view-model used by
 * the existing SignalDesk components. Keeping the mapping here means components
 * never depend on the wire shape and never parse envelopes or provider errors.
 */

import type { Lead as CanonicalLead } from "@/contracts";
import type {
  Confidence,
  Evidence,
  Lead as ViewLead,
  WorkflowStep,
} from "@/lib/demo/types";

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toUpperCaseConfidence(
  value: CanonicalLead["enrichment"]["confidence"],
): Confidence {
  return value.toUpperCase() as Confidence;
}

function criterionScore(lead: CanonicalLead, key: string): number {
  return (
    lead.qualification.criteria.find((criterion) => criterion.key === key)
      ?.score ?? 0
  );
}

function toEvidence(lead: CanonicalLead): Evidence[] {
  return lead.enrichment.evidence.map((item) => ({
    id: item.id,
    label: item.label,
    url: item.sourceUrl ?? undefined,
    sourceType: item.kind === "source" ? "WEBSITE" : "AI_INFERENCE",
    confidence: toUpperCaseConfidence(item.confidence),
  }));
}

function toWorkflowStep(step: CanonicalLead["workflow"]["steps"][number]): WorkflowStep {
  return {
    id: step.key,
    title: step.name,
    status: step.status,
    timestamp: step.completedAt ?? step.startedAt ?? undefined,
    durationMs: step.durationMs ?? undefined,
    detail: step.errorMessage ?? step.name,
  };
}

export function toViewLead(lead: CanonicalLead): ViewLead {
  return {
    id: lead.id,
    fullName: lead.contact.fullName,
    initials: initialsFromName(lead.contact.fullName),
    workEmail: lead.contact.workEmail,
    role: lead.contact.role ?? "Role not provided",
    source: lead.contact.source,
    company: {
      name: lead.company.name,
      domain: lead.company.domain,
      website: lead.company.website,
      industry: lead.company.industry ?? "Researching…",
      estimatedSize: lead.company.estimatedSize ?? "Researching…",
      businessModel: lead.company.businessModel ?? "Researching…",
      location: lead.company.location ?? "Researching…",
      summary:
        lead.enrichment.summary ?? "Company intelligence is being prepared.",
      technologies: lead.enrichment.technologies,
    },
    qualification: {
      score: lead.qualification.score,
      tier: lead.qualification.tier,
      reasoning: lead.qualification.reasoning,
      criteria: {
        companyFit: criterionScore(lead, "companyFit"),
        problemFit: criterionScore(lead, "problemFit"),
        buyingSignal: criterionScore(lead, "buyingSignal"),
        dataConfidence: criterionScore(lead, "dataConfidence"),
      },
      riskFlags: lead.qualification.riskFlags.map((flag) => flag.label),
    },
    enrichment: {
      painPoints: lead.enrichment.painPoints,
      evidence: toEvidence(lead),
      confidence: toUpperCaseConfidence(lead.enrichment.confidence),
    },
    draft: {
      subject: lead.draft.subject,
      body: lead.draft.body,
      status: lead.draft.status,
      version: lead.draft.version,
      lastEditedAt: lead.draft.lastEditedAt ?? lead.updatedAt,
    },
    workflow: lead.workflow.steps.map(toWorkflowStep),
    status: lead.status,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    processingDurationMs: lead.workflow.processingDurationMs ?? undefined,
  };
}
