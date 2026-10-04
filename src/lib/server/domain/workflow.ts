import "server-only";

import type {
  StepStatus,
  WorkflowState,
  WorkflowStep,
  WorkflowStepKey,
} from "@/contracts";
import { WORKFLOW_STEP_KEYS, WORKFLOW_STEP_LABELS } from "@/contracts";

/**
 * Stages executed by the enrichment orchestrator, in order. `captured` is set
 * at lead creation; `approve`/`send` are driven by their own endpoints.
 */
export const ENRICHMENT_STAGES: WorkflowStepKey[] = [
  "validate",
  "research",
  "extract",
  "score",
  "draft",
  "review",
];

export const ACTION_STAGES: WorkflowStepKey[] = ["captured", "approve", "send"];

export function createWorkflowStep(
  key: WorkflowStepKey,
  status: StepStatus = "PENDING",
): WorkflowStep {
  return {
    key,
    name: WORKFLOW_STEP_LABELS[key],
    status,
    attempt: 0,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    errorCode: null,
    errorMessage: null,
  };
}

export function createInitialWorkflow(now: string): WorkflowState {
  const steps = WORKFLOW_STEP_KEYS.map((key) =>
    key === "captured"
      ? {
          ...createWorkflowStep(key, "SUCCEEDED" as const),
          attempt: 1,
          startedAt: now,
          completedAt: now,
          durationMs: 0,
        }
      : createWorkflowStep(key),
  );

  return {
    currentStage: "captured",
    steps,
    attempts: 0,
    processingDurationMs: null,
  };
}

export function getStep(
  workflow: WorkflowState,
  key: WorkflowStepKey,
): WorkflowStep | undefined {
  return workflow.steps.find((step) => step.key === key);
}

export function isStageComplete(
  workflow: WorkflowState,
  key: WorkflowStepKey,
): boolean {
  const step = getStep(workflow, key);
  return step?.status === "SUCCEEDED" || step?.status === "SKIPPED";
}

export function allStagesComplete(workflow: WorkflowState): boolean {
  return ENRICHMENT_STAGES.every((key) => isStageComplete(workflow, key));
}

/** The first stage that still needs work, or `null` when everything is done. */
export function nextPendingStage(
  workflow: WorkflowState,
): WorkflowStepKey | null {
  for (const key of ENRICHMENT_STAGES) {
    const step = getStep(workflow, key);
    if (!step) return key;
    if (step.status === "PENDING" || step.status === "FAILED") return key;
  }
  return null;
}

export function currentStageFrom(workflow: WorkflowState): WorkflowStepKey {
  if (getStep(workflow, "send")?.status === "SUCCEEDED") return "send";
  if (getStep(workflow, "approve")?.status === "SUCCEEDED") return "approve";
  const pending = nextPendingStage(workflow);
  if (pending) return pending;
  return "review";
}
