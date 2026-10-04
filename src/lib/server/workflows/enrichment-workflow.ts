import "server-only";

import type {
  CompanyIntelligence,
  Lead,
  Qualification,
  WorkflowState,
  WorkflowStep,
  WorkflowStepKey,
} from "@/contracts";

import { AppError, ProviderFailureError } from "@/lib/server/domain/errors";
import { buildRiskFlags } from "@/lib/server/domain/risk";
import { buildQualification } from "@/lib/server/domain/scoring";
import { diffMs, isoNow } from "@/lib/server/domain/time";
import {
  currentStageFrom,
  ENRICHMENT_STAGES,
  getStep,
  nextPendingStage,
} from "@/lib/server/domain/workflow";
import type { ProviderRegistry } from "@/lib/server/providers";
import type {
  CompanyResearchResult,
  ExtractedIntelligence,
  NormalizedLeadInput,
} from "@/lib/server/providers/types";

export interface EnrichmentRun {
  lead: Lead;
  /** Stages executed (or attempted) during this run. */
  executed: WorkflowStepKey[];
  /** False when the call was a no-op because the lead is already resolved. */
  ran: boolean;
}

function inputFromLead(lead: Lead): NormalizedLeadInput {
  return { contact: lead.contact, company: lead.company };
}

function updateStep(
  workflow: WorkflowState,
  key: WorkflowStepKey,
  patch: Partial<WorkflowStep>,
): WorkflowState {
  return {
    ...workflow,
    steps: workflow.steps.map((step) =>
      step.key === key ? { ...step, ...patch } : step,
    ),
  };
}

function sumStageDuration(workflow: WorkflowState): number | null {
  const durations = ENRICHMENT_STAGES.map((key) => getStep(workflow, key))
    .map((step) => step?.durationMs ?? null)
    .filter((value): value is number => value !== null);
  if (durations.length === 0) return null;
  return durations.reduce((total, value) => total + value, 0);
}

function terminalStageWithError(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "INTERNAL_ERROR",
    message: "The workflow failed unexpectedly. Retry to continue.",
  };
}

/**
 * Run (or resume) the enrichment workflow for a single lead.
 *
 * Idempotency guarantees:
 * - Approved/sent leads are returned unchanged; the approved draft is never
 *   overwritten.
 * - Stages that already succeeded are skipped; only failed/pending stages run.
 * - A partial run keeps whatever intelligence/score/draft was already produced.
 */
export async function runEnrichmentWorkflow(
  lead: Lead,
  providers: ProviderRegistry,
): Promise<EnrichmentRun> {
  if (lead.status === "APPROVED" || lead.status === "SENT") {
    return { lead, executed: [], ran: false };
  }

  const startStage = nextPendingStage(lead.workflow);
  if (startStage === null) {
    return { lead, executed: [], ran: false };
  }

  const executed: WorkflowStepKey[] = [];
  const now = isoNow();
  const input = inputFromLead(lead);

  let working: Lead = {
    ...structuredClone(lead),
    status: "PROCESSING",
    updatedAt: now,
    lastActivityAt: now,
    workflow: {
      ...lead.workflow,
      attempts: lead.workflow.attempts + 1,
    },
  };

  let research: CompanyResearchResult | null = null;
  let intelligence: ExtractedIntelligence | null = null;

  const ensureResearch = async (): Promise<CompanyResearchResult> => {
    if (research) return research;
    research = await providers.research.research(input);
    return research;
  };

  const ensureIntelligence = async (): Promise<ExtractedIntelligence> => {
    if (intelligence) return intelligence;
    const fetched = await ensureResearch();
    intelligence = await providers.intelligence.extract(input, fetched);
    return intelligence;
  };

  const stageIndex = ENRICHMENT_STAGES.indexOf(startStage);
  const stagesToRun = ENRICHMENT_STAGES.slice(stageIndex);

  for (const stage of stagesToRun) {
    executed.push(stage);
    const startedAt = isoNow();
    const priorAttempt = getStep(working.workflow, stage)?.attempt ?? 0;

    working.workflow = updateStep(working.workflow, stage, {
      status: "RUNNING",
      attempt: priorAttempt + 1,
      startedAt,
      completedAt: null,
      durationMs: null,
      errorCode: null,
      errorMessage: null,
    });
    working.workflow.currentStage = stage;

    try {
      await executeStage(stage, {
        lead: working,
        input,
        providers,
        ensureResearch,
        ensureIntelligence,
        applyCompany: (extracted) => {
          working = {
            ...working,
            company: {
              ...working.company,
              industry: extracted.industry,
              estimatedSize: extracted.estimatedSize,
              businessModel: extracted.businessModel,
              location: extracted.location,
            },
            enrichment: {
              summary: extracted.summary,
              painPoints: extracted.painPoints,
              technologies: extracted.technologies,
              evidence: extracted.evidence,
              confidence: extracted.confidence,
            } satisfies CompanyIntelligence,
          };
        },
        applyQualification: (qualification: Qualification) => {
          working = { ...working, qualification };
        },
        applyDraft: (subject: string, body: string) => {
          const nowIso = isoNow();
          working = {
            ...working,
            draft: {
              subject,
              body,
              status: "DRAFT",
              version: working.draft.subject || working.draft.body
                ? working.draft.version + 1
                : 1,
              lastEditedAt: nowIso,
            },
          };
        },
        shouldDraft: () =>
          working.draft.status !== "APPROVED" &&
          working.draft.status !== "SENT",
      });

      const completedAt = isoNow();
      working.workflow = updateStep(working.workflow, stage, {
        status: "SUCCEEDED",
        completedAt,
        durationMs: diffMs(startedAt, completedAt),
      });
    } catch (error) {
      const { code, message } = terminalStageWithError(error);
      const completedAt = isoNow();
      working = {
        ...working,
        status: "FAILED",
        updatedAt: completedAt,
        lastActivityAt: completedAt,
        workflow: updateStep(working.workflow, stage, {
          status: "FAILED",
          completedAt,
          durationMs: diffMs(startedAt, completedAt),
          errorCode: code,
          errorMessage: message,
        }),
      };
      working.workflow.currentStage = currentStageFrom(working.workflow);
      working.workflow.processingDurationMs = sumStageDuration(working.workflow);
      return { lead: working, executed, ran: true };
    }
  }

  const completedAt = isoNow();
  working = {
    ...working,
    status: "READY_FOR_REVIEW",
    updatedAt: completedAt,
    lastActivityAt: completedAt,
  };
  working.workflow.currentStage = currentStageFrom(working.workflow);
  working.workflow.processingDurationMs = sumStageDuration(working.workflow);

  return { lead: working, executed, ran: true };
}

interface StageContext {
  lead: Lead;
  input: NormalizedLeadInput;
  providers: ProviderRegistry;
  ensureResearch: () => Promise<CompanyResearchResult>;
  ensureIntelligence: () => Promise<ExtractedIntelligence>;
  applyCompany: (intelligence: ExtractedIntelligence) => void;
  applyQualification: (qualification: Qualification) => void;
  applyDraft: (subject: string, body: string) => void;
  shouldDraft: () => boolean;
}

async function executeStage(
  stage: WorkflowStepKey,
  context: StageContext,
): Promise<void> {
  switch (stage) {
    case "validate": {
      if (!context.input.contact.workEmail || !context.input.company.website) {
        throw new AppError(
          "VALIDATION_FAILED",
          "Lead contact and company details are required",
          400,
        );
      }
      return;
    }
    case "research": {
      const result = await context.ensureResearch();
      if (!result.reachable) {
        throw new ProviderFailureError(
          "Company website could not be retrieved",
          "RESEARCH_FAILED",
        );
      }
      return;
    }
    case "extract": {
      const extracted = await context.ensureIntelligence();
      context.applyCompany(extracted);
      return;
    }
    case "score": {
      const extracted = await context.ensureIntelligence();
      const research = await context.ensureResearch();
      const riskFlags = buildRiskFlags({
        workEmail: context.lead.contact.workEmail,
        websiteReachable: research.reachable,
        researchSucceeded: true,
        hasSummary: extracted.summary.length > 0,
        hasPainPoints: extracted.painPoints.length > 0,
        confidence: extracted.confidence,
      });

      // Free email lowers data confidence but never disqualifies the lead.
      const suggestions = { ...extracted.criterionSuggestions };
      if (riskFlags.some((flag) => flag.code === "FREE_EMAIL")) {
        suggestions.dataConfidence = Math.max(
          0,
          (suggestions.dataConfidence ?? 0) - 3,
        );
      }

      context.applyQualification(
        buildQualification(suggestions, riskFlags, isoNow()),
      );
      return;
    }
    case "draft": {
      if (!context.shouldDraft()) return;
      const extracted = await context.ensureIntelligence();
      const draft = await context.providers.intelligence.draft({
        input: context.input,
        intelligence: {
          summary: extracted.summary,
          painPoints: extracted.painPoints,
          technologies: extracted.technologies,
          evidence: extracted.evidence,
          confidence: extracted.confidence,
        },
        topPainPoint: extracted.painPoints[0] ?? null,
      });
      if (!draft.subject.trim() || !draft.body.trim()) {
        throw new ProviderFailureError(
          "The generated draft was empty",
          "DRAFT_INVALID",
        );
      }
      context.applyDraft(draft.subject.trim(), draft.body.trim());
      return;
    }
    case "review": {
      return;
    }
    default:
      return;
  }
}
