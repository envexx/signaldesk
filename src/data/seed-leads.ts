import "server-only";

import type {
  ActivityEvent,
  ActivityKind,
  ContactIdentity,
  CompanyProfile,
  CriterionKey,
  Lead,
  Qualification,
  RiskFlag,
  WorkflowStep,
  WorkflowStepKey,
} from "@/contracts";
import {
  WORKFLOW_STEP_KEYS,
  companyNameFromDomain,
  normalizeEmail,
  normalizeWebsite,
} from "@/contracts";

import { newEventId } from "@/lib/server/domain/ids";
import { emptyDraft, emptyEnrichment } from "@/lib/server/domain/lead-factory";
import { buildRiskFlags } from "@/lib/server/domain/risk";
import {
  buildQualification,
  unscoredQualification,
} from "@/lib/server/domain/scoring";
import { addMs, minutesAgoIso } from "@/lib/server/domain/time";
import {
  ENRICHMENT_STAGES,
  createWorkflowStep,
} from "@/lib/server/domain/workflow";
import {
  DemoCompanyResearchProvider,
  DemoLeadIntelligenceProvider,
} from "@/lib/server/providers/demo";

export interface SeedData {
  leads: Lead[];
  activity: ActivityEvent[];
}

type SeedScenario =
  | "captured"
  | "processing"
  | "failed-research"
  | "ready"
  | "approved"
  | "sent";

interface SeedSpec {
  fullName: string;
  workEmail: string;
  role: string;
  source: string;
  website: string;
  companyName: string;
  minutesAgo: number;
  scenario: SeedScenario;
  scoreOverride?: Partial<Record<CriterionKey, number>>;
  riskOverride?: RiskFlag[];
}

const STAGE_DURATION_MS: Record<WorkflowStepKey, number> = {
  captured: 0,
  validate: 640,
  research: 2380,
  extract: 3120,
  score: 880,
  draft: 4260,
  review: 320,
  approve: 540,
  send: 760,
};

function buildSteps(params: {
  baseIso: string;
  succeeded: WorkflowStepKey[];
  failed?: { key: WorkflowStepKey; code: string; message: string };
}): WorkflowStep[] {
  let cursor = params.baseIso;
  return WORKFLOW_STEP_KEYS.map((key) => {
    const step = createWorkflowStep(key);

    if (key === "captured") {
      return {
        ...step,
        status: "SUCCEEDED" as const,
        attempt: 1,
        startedAt: params.baseIso,
        completedAt: params.baseIso,
        durationMs: 0,
      };
    }

    if (params.failed?.key === key) {
      const startedAt = cursor;
      const completedAt = addMs(startedAt, STAGE_DURATION_MS[key]);
      cursor = completedAt;
      return {
        ...step,
        status: "FAILED" as const,
        attempt: 1,
        startedAt,
        completedAt,
        durationMs: STAGE_DURATION_MS[key],
        errorCode: params.failed.code,
        errorMessage: params.failed.message,
      };
    }

    if (params.succeeded.includes(key)) {
      const startedAt = cursor;
      const completedAt = addMs(startedAt, STAGE_DURATION_MS[key]);
      cursor = completedAt;
      return {
        ...step,
        status: "SUCCEEDED" as const,
        attempt: 1,
        startedAt,
        completedAt,
        durationMs: STAGE_DURATION_MS[key],
      };
    }

    return step;
  });
}

function lastCompletedAt(steps: WorkflowStep[], fallback: string): string {
  const completed = steps
    .filter(
      (step) =>
        (step.status === "SUCCEEDED" || step.status === "FAILED") &&
        step.completedAt,
    )
    .map((step) => step.completedAt as string)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return completed.length > 0 ? completed[completed.length - 1] : fallback;
}

function processingDuration(steps: WorkflowStep[]): number | null {
  const durations = ENRICHMENT_STAGES.map((key) =>
    steps.find((step) => step.key === key),
  )
    .filter((step): step is WorkflowStep => Boolean(step?.completedAt))
    .map((step) => step.durationMs ?? 0)
    .filter((value) => value > 0);
  if (durations.length === 0) return null;
  return durations.reduce((total, value) => total + value, 0);
}

async function buildSeedLead(
  spec: SeedSpec,
  reference: Date,
  providers: {
    research: DemoCompanyResearchProvider;
    intelligence: DemoLeadIntelligenceProvider;
  },
): Promise<Lead> {
  const normalizedWebsite = normalizeWebsite(spec.website);
  if (!normalizedWebsite) {
    throw new Error(`Seed website is invalid: ${spec.website}`);
  }

  const baseIso = minutesAgoIso(reference, spec.minutesAgo);
  const companyName = spec.companyName || companyNameFromDomain(normalizedWebsite.domain);

  const contact: ContactIdentity = {
    fullName: spec.fullName,
    workEmail: normalizeEmail(spec.workEmail),
    role: spec.role,
    source: spec.source,
  };

  const company: CompanyProfile = {
    name: companyName,
    domain: normalizedWebsite.domain,
    website: normalizedWebsite.website,
    industry: null,
    estimatedSize: null,
    businessModel: null,
    location: null,
  };

  const runFullEnrichment = ["ready", "approved", "sent"].includes(spec.scenario);

  let enrichment = emptyEnrichment();
  let qualification: Qualification = unscoredQualification();
  let draft = emptyDraft();
  let workedCompany = company;

  if (runFullEnrichment) {
    const input = { contact, company };
    const research = await providers.research.research(input);
    const extracted = await providers.intelligence.extract(input, research);

    workedCompany = {
      ...company,
      industry: extracted.industry,
      estimatedSize: extracted.estimatedSize,
      businessModel: extracted.businessModel,
      location: extracted.location,
    };

    enrichment = {
      summary: extracted.summary,
      painPoints: extracted.painPoints,
      technologies: extracted.technologies,
      evidence: extracted.evidence,
      confidence: extracted.confidence,
    };

    const riskFlags =
      spec.riskOverride ??
      buildRiskFlags({
        workEmail: contact.workEmail,
        websiteReachable: research.reachable,
        researchSucceeded: true,
        hasSummary: true,
        hasPainPoints: extracted.painPoints.length > 0,
        confidence: extracted.confidence,
      });

    qualification = buildQualification(
      spec.scoreOverride ?? extracted.criterionSuggestions,
      riskFlags,
      addMs(baseIso, 7000),
    );

    const generated = await providers.intelligence.draft({
      input: { contact, company: workedCompany },
      intelligence: enrichment,
      topPainPoint: extracted.painPoints[0] ?? null,
    });
    draft = {
      subject: generated.subject,
      body: generated.body,
      status:
        spec.scenario === "sent"
          ? "SENT"
          : spec.scenario === "approved"
            ? "APPROVED"
            : "DRAFT",
      version: 1,
      lastEditedAt: addMs(baseIso, 7500),
    };
  }

  let succeeded: WorkflowStepKey[] = [];
  let failed:
    | { key: WorkflowStepKey; code: string; message: string }
    | undefined;
  let status: Lead["status"] = "CAPTURED";
  let attempts = 0;
  let currentStage: WorkflowStepKey = "captured";

  switch (spec.scenario) {
    case "ready":
      succeeded = [...ENRICHMENT_STAGES];
      status = "READY_FOR_REVIEW";
      currentStage = "review";
      attempts = 1;
      break;
    case "approved":
      succeeded = [...ENRICHMENT_STAGES, "approve"];
      status = "APPROVED";
      currentStage = "approve";
      attempts = 1;
      break;
    case "sent":
      succeeded = [...ENRICHMENT_STAGES, "approve", "send"];
      status = "SENT";
      currentStage = "send";
      attempts = 1;
      break;
    case "processing":
      succeeded = ["validate", "research"];
      status = "PROCESSING";
      currentStage = "extract";
      attempts = 1;
      break;
    case "failed-research":
      succeeded = ["validate"];
      failed = {
        key: "research",
        code: "RESEARCH_FAILED",
        message: "Company website could not be retrieved",
      };
      status = "FAILED";
      currentStage = "research";
      attempts = 1;
      break;
    default:
      succeeded = [];
      status = "CAPTURED";
      currentStage = "captured";
      attempts = 0;
      break;
  }

  if (!runFullEnrichment) {
    const fallbackRisks: RiskFlag[] =
      spec.scenario === "failed-research"
        ? [
            {
              code: "WEBSITE_UNREACHABLE",
              label: "Website could not be fully retrieved",
              severity: "high",
            },
          ]
        : [];
    qualification = {
      ...unscoredQualification(),
      riskFlags: spec.riskOverride ?? fallbackRisks,
    };
  }

  const steps = buildSteps({ baseIso, succeeded, failed });
  const lastActivityAt = lastCompletedAt(steps, baseIso);
  const processing = processingDuration(steps);

  return {
    id: `lead_${normalizedWebsite.domain.replace(/[^a-z0-9]+/g, "-")}`,
    contact,
    company: spec.scenario === "failed-research" ? company : workedCompany,
    qualification,
    enrichment,
    draft,
    workflow: {
      currentStage,
      steps,
      attempts,
      processingDurationMs: runFullEnrichment ? processing : null,
    },
    status,
    createdAt: baseIso,
    updatedAt: lastActivityAt,
    lastActivityAt,
    idempotencyKey: null,
  };
}

function activityFor(lead: Lead): ActivityEvent {
  const kindByStatus: Record<Lead["status"], ActivityKind> = {
    CAPTURED: "lead.captured",
    PROCESSING: "workflow.started",
    READY_FOR_REVIEW: "workflow.completed",
    APPROVED: "draft.approved",
    SENT: "lead.sent",
    FAILED: "workflow.failed",
  };
  const messageByStatus: Record<Lead["status"], string> = {
    CAPTURED: `${lead.contact.fullName} was captured from ${lead.contact.source}.`,
    PROCESSING: `Enrichment started for ${lead.company.name}.`,
    READY_FOR_REVIEW: `Draft for ${lead.company.name} is awaiting approval.`,
    APPROVED: `Draft for ${lead.company.name} was approved.`,
    SENT: `Message to ${lead.company.name} was marked as sent.`,
    FAILED: `Enrichment failed for ${lead.company.name} at the research step.`,
  };

  return {
    id: newEventId(),
    kind: kindByStatus[lead.status],
    message: messageByStatus[lead.status],
    leadId: lead.id,
    companyName: lead.company.name,
    tier: lead.qualification.tier === "UNASSESSED" ? null : lead.qualification.tier,
    occurredAt: lead.lastActivityAt,
  };
}

const SEED_SPECS: SeedSpec[] = [
  {
    fullName: "Amelia Chen",
    workEmail: "amelia.chen@northwind-logistics.com",
    role: "VP Operations",
    source: "webhook",
    website: "northwind-logistics.com",
    companyName: "Northwind Logistics",
    minutesAgo: 38,
    scenario: "ready",
    scoreOverride: { companyFit: 32, problemFit: 27, buyingSignal: 17, dataConfidence: 14 },
  },
  {
    fullName: "Daniel Okafor",
    workEmail: "daniel.okafor@lumen-health.io",
    role: "Head of Growth",
    source: "manual",
    website: "lumen-health.io",
    companyName: "Lumen Health",
    minutesAgo: 176,
    scenario: "approved",
    scoreOverride: { companyFit: 30, problemFit: 26, buyingSignal: 16, dataConfidence: 14 },
  },
  {
    fullName: "Sofia Marchetti",
    workEmail: "sofia.marchetti@copperfield-realty.com",
    role: "Marketing Lead",
    source: "webhook",
    website: "copperfield-realty.com",
    companyName: "Copperfield Realty",
    minutesAgo: 92,
    scenario: "ready",
    scoreOverride: { companyFit: 22, problemFit: 18, buyingSignal: 12, dataConfidence: 10 },
  },
  {
    fullName: "Rowan Ellis",
    workEmail: "rowan.ellis@greensprout-grocers.com",
    role: "Chief Operating Officer",
    source: "manual",
    website: "greensprout-grocers.com",
    companyName: "GreenSprout Grocers",
    minutesAgo: 9,
    scenario: "processing",
    scoreOverride: { companyFit: 20, problemFit: 16, buyingSignal: 10, dataConfidence: 9 },
  },
  {
    fullName: "Kenji Watanabe",
    workEmail: "kenji@byteharbor.dev",
    role: "Founder",
    source: "webhook",
    website: "byteharbor.dev",
    companyName: "ByteHarbor",
    minutesAgo: 254,
    scenario: "ready",
    scoreOverride: { companyFit: 6, problemFit: 5, buyingSignal: 2, dataConfidence: 5 },
  },
  {
    fullName: "Marcus Reed",
    workEmail: "marcus.reed@atlas-freight.com",
    role: "Operations Manager",
    source: "webhook",
    website: "atlas-freight.com",
    companyName: "Atlas Freight",
    minutesAgo: 610,
    scenario: "failed-research",
    riskOverride: [
      { code: "WEBSITE_UNREACHABLE", label: "Website could not be fully retrieved", severity: "high" },
    ],
  },
  {
    fullName: "Maya Rivera",
    workEmail: "maya.rivera@gmail.com",
    role: "Independent Consultant",
    source: "manual",
    website: "maya-rivera-consulting.com",
    companyName: "Maya Rivera Consulting",
    minutesAgo: 5,
    scenario: "captured",
    riskOverride: [
      { code: "FREE_EMAIL", label: "Free email provider", severity: "medium" },
    ],
  },
  {
    fullName: "Priya Nair",
    workEmail: "priya.nair@quanta-robotics.com",
    role: "Director of Sales",
    source: "manual",
    website: "quanta-robotics.com",
    companyName: "Quanta Robotics",
    minutesAgo: 1_435,
    scenario: "sent",
    scoreOverride: { companyFit: 31, problemFit: 25, buyingSignal: 15, dataConfidence: 13 },
  },
];

/**
 * Deterministic demo dataset. Seed timestamps are relative to server start so
 * the "age" column stays realistic and stable across portfolio screenshots.
 */
export async function buildSeedData(): Promise<SeedData> {
  const reference = new Date();
  const providers = {
    research: new DemoCompanyResearchProvider(),
    intelligence: new DemoLeadIntelligenceProvider(),
  };

  const leads = await Promise.all(
    SEED_SPECS.map((spec) => buildSeedLead(spec, reference, providers)),
  );

  const activity = leads
    .map(activityFor)
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    .slice(0, 12);

  return { leads, activity };
}
