import "server-only";

import type {
  ActivityKind,
  Lead,
  WorkflowStep,
  WorkflowStepKey,
} from "@/contracts";
import type { ApproveLeadPayload } from "@/contracts";
import type { SendEmailResult } from "@/lib/server/providers/types";

import {
  ConflictError,
  NotReadyError,
  NotFoundError,
  UnprocessableError,
  VersionConflictError,
  isAppError,
} from "@/lib/server/domain/errors";
import { newEventId, newId } from "@/lib/server/domain/ids";
import { isoNow } from "@/lib/server/domain/time";
import {
  ENRICHMENT_STAGES,
  currentStageFrom,
  getStep,
} from "@/lib/server/domain/workflow";
import { getProviderRegistry } from "@/lib/server/providers";
import {
  METRIC,
  increment,
  observeEnrichmentDuration,
} from "@/lib/server/observability/metrics";
import { getLeadRepository } from "@/lib/server/repositories";
import { getDeliveryRepository } from "@/lib/server/repositories/delivery-repository";
import { resolveEmailDeliveryProvider } from "@/lib/server/services/email-service";
import { runEnrichmentWorkflow } from "@/lib/server/workflows/enrichment-workflow";

async function loadLead(id: string): Promise<Lead> {
  const lead = await getLeadRepository().getById(id);
  if (!lead) throw new NotFoundError();
  return lead;
}

async function persist(lead: Lead): Promise<Lead> {
  const updated = await getLeadRepository().update(lead.id, () => lead);
  return updated ?? lead;
}

async function record(
  kind: ActivityKind,
  message: string,
  lead: Lead,
): Promise<void> {
  await getLeadRepository().addActivity({
    id: newEventId(),
    kind,
    message,
    leadId: lead.id,
    companyName: lead.company.name,
    tier: lead.qualification.tier === "UNASSESSED" ? null : lead.qualification.tier,
    occurredAt: lead.lastActivityAt,
  });
}

function withStep(
  workflow: Lead["workflow"],
  key: WorkflowStepKey,
  status: WorkflowStep["status"],
  patch: Partial<WorkflowStep> = {},
): Lead["workflow"] {
  return {
    ...workflow,
    steps: workflow.steps.map((step) =>
      step.key === key ? { ...step, status, ...patch } : step,
    ),
  };
}

export interface ProcessLeadResult {
  lead: Lead;
  executed: WorkflowStepKey[];
  ran: boolean;
}

export interface ProcessLeadOptions {
  /** Re-run stages that already succeeded (explicit user request). */
  force?: boolean;
}

const RERUNNABLE_STAGES = new Set<WorkflowStepKey>([
  ...ENRICHMENT_STAGES,
  "approve",
  "send",
]);

function resetForRerun(lead: Lead): Lead {
  return {
    ...lead,
    status: "PROCESSING",
    draft:
      lead.draft.status === "APPROVED" || lead.draft.status === "SENT"
        ? { ...lead.draft, status: "DRAFT" }
        : lead.draft,
    workflow: {
      ...lead.workflow,
      currentStage: "captured",
      processingDurationMs: null,
      steps: lead.workflow.steps.map((step) =>
        RERUNNABLE_STAGES.has(step.key)
          ? {
              ...step,
              status: "PENDING" as const,
              startedAt: null,
              completedAt: null,
              durationMs: null,
              errorCode: null,
              errorMessage: null,
            }
          : step,
      ),
    },
  };
}

/**
 * Run or resume the enrichment workflow. Safe to call repeatedly: succeeded
 * stages are skipped and approved drafts are never regenerated. Pass
 * `force: true` to explicitly re-run every stage.
 */
export async function processLead(
  id: string,
  options: ProcessLeadOptions = {},
): Promise<ProcessLeadResult> {
  let lead = await loadLead(id);

  if (options.force) {
    if (lead.status === "SENT") {
      throw new ConflictError("A sent lead cannot be re-enriched.");
    }
    lead = resetForRerun(lead);
  }

  const outcome = await runEnrichmentWorkflow(lead, getProviderRegistry());
  if (!outcome.ran) {
    return { lead: outcome.lead, executed: [], ran: false };
  }

  const saved = await persist(outcome.lead);
  await record(
    saved.status === "FAILED" ? "workflow.failed" : "workflow.completed",
    saved.status === "FAILED"
      ? `Enrichment stopped for ${saved.company.name}; partial results were kept.`
      : `Enrichment completed for ${saved.company.name}.`,
    saved,
  );

  if (saved.status === "FAILED") {
    increment(METRIC.enrichmentFailed);
  } else {
    increment(METRIC.enrichmentSucceeded);
    observeEnrichmentDuration(saved.workflow.processingDurationMs ?? 0);
  }

  return { lead: saved, executed: outcome.executed, ran: true };
}

export interface ApproveLeadResult {
  lead: Lead;
  alreadyApproved: boolean;
}

/**
 * Mark a lead as PROCESSING before an async job is dispatched, so the UI can
 * start polling and show progress instead of a stale "Captured" state.
 */
export async function markLeadProcessing(id: string): Promise<Lead> {
  const lead = await loadLead(id);
  if (lead.status === "SENT") return lead;
  const now = isoNow();
  return persist({
    ...lead,
    status: "PROCESSING",
    updatedAt: now,
    lastActivityAt: now,
  });
}

/**
 * Explicit human approval. In demo mode this never triggers an external send —
 * it only moves the lead to APPROVED. Approval is idempotent.
 */
export async function approveLead(
  id: string,
  payload: ApproveLeadPayload,
): Promise<ApproveLeadResult> {
  const lead = await loadLead(id);

  if (lead.status === "SENT") {
    throw new ConflictError("This message has already been sent.");
  }
  if (lead.status === "CAPTURED" || lead.status === "PROCESSING") {
    throw new NotReadyError(
      "Enrichment is still running. Wait for it to finish before approving.",
    );
  }
  if (lead.status === "FAILED") {
    throw new NotReadyError("Retry enrichment before approving this draft.");
  }

  if (
    payload.version !== undefined &&
    payload.version !== lead.draft.version
  ) {
    throw new VersionConflictError(
      "This draft changed since it was loaded. Reload and review the latest version.",
    );
  }

  const nextSubject = (payload.subject ?? lead.draft.subject).trim();
  const nextBody = (payload.body ?? lead.draft.body).trim();
  if (!nextSubject || !nextBody) {
    throw new UnprocessableError(
      "Add a subject and body before approving the draft.",
      { draft: ["Subject and body are required"] },
    );
  }

  const hasEdits = Boolean(payload.subject || payload.body);
  if (lead.status === "APPROVED" && !hasEdits) {
    return { lead, alreadyApproved: true };
  }

  const now = isoNow();
  const next: Lead = {
    ...lead,
    status: "APPROVED",
    updatedAt: now,
    lastActivityAt: now,
    draft: {
      ...lead.draft,
      subject: nextSubject,
      body: nextBody,
      status: "APPROVED",
      version: hasEdits ? lead.draft.version + 1 : lead.draft.version,
      lastEditedAt: hasEdits ? now : lead.draft.lastEditedAt,
    },
  };

  const approveStep = getStep(lead.workflow, "approve");
  next.workflow = withStep(next.workflow, "approve", "SUCCEEDED", {
    attempt: (approveStep?.attempt ?? 0) + 1,
    startedAt: now,
    completedAt: now,
    durationMs: 0,
    errorCode: null,
    errorMessage: null,
  });
  next.workflow.currentStage = currentStageFrom(next.workflow);

  const saved = await persist(next);
  await record("draft.approved", `Draft for ${saved.company.name} was approved.`, saved);
  increment(METRIC.draftsApproved);

  const registry = getProviderRegistry();
  if (registry.crm.enabled) {
    try {
      await registry.crm.upsertLead(saved);
    } catch {
      // CRM sync is best-effort and must never block human approval.
    }
  }

  return { lead: saved, alreadyApproved: false };
}

export interface RejectLeadResult {
  lead: Lead;
  alreadyRejected: boolean;
}

/**
 * Explicit rejection. The draft is marked REJECTED and the lead returns to
 * READY_FOR_REVIEW so a human can rewrite or re-enrich before approving.
 */
export async function rejectLead(id: string): Promise<RejectLeadResult> {
  const lead = await loadLead(id);

  if (lead.status === "SENT") {
    throw new ConflictError("This message has already been sent.");
  }
  if (lead.status === "CAPTURED" || lead.status === "PROCESSING") {
    throw new NotReadyError("Enrichment is still running. Wait before rejecting.");
  }
  if (lead.status === "FAILED") {
    throw new NotReadyError("Retry enrichment before rejecting this draft.");
  }
  if (lead.draft.status === "REJECTED") {
    return { lead, alreadyRejected: true };
  }

  const now = isoNow();
  const next: Lead = {
    ...lead,
    status: "READY_FOR_REVIEW",
    updatedAt: now,
    lastActivityAt: now,
    draft: { ...lead.draft, status: "REJECTED", lastEditedAt: now },
  };
  next.workflow = withStep(next.workflow, "approve", "PENDING", {
    completedAt: null,
    durationMs: null,
    errorCode: null,
    errorMessage: null,
  });
  next.workflow.currentStage = currentStageFrom(next.workflow);

  const saved = await persist(next);
  await record(
    "draft.rejected",
    `Draft for ${saved.company.name} was rejected and returned for review.`,
    saved,
  );

  return { lead: saved, alreadyRejected: false };
}

export interface SendLeadResult {
  lead: Lead;
  delivery: SendEmailResult | null;
}

/**
 * Send the approved draft. Records a delivery entry in the Outbox for every
 * attempt: real send via Resend when configured, otherwise a clearly-labelled
 * "simulated" delivery so the pipeline completes in demo mode.
 */
export async function sendLead(id: string): Promise<SendLeadResult> {
  const lead = await loadLead(id);

  if (lead.status !== "APPROVED") {
    throw new NotReadyError("Approve the draft before sending.");
  }

  const emailProvider = await resolveEmailDeliveryProvider();
  const now = isoNow();
  const deliveryId = newId("dlv");
  const deliveries = getDeliveryRepository();

  let delivery: SendEmailResult | null = null;

  if (emailProvider.enabled) {
    await deliveries.create({
      id: deliveryId,
      leadId: lead.id,
      toEmail: lead.contact.workEmail,
      subject: lead.draft.subject,
      provider: emailProvider.name,
      status: "SENT",
      providerMessageId: null,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
    });

    try {
      delivery = await emailProvider.send({
        leadId: lead.id,
        to: lead.contact.workEmail,
        subject: lead.draft.subject,
        body: lead.draft.body,
      });
      await deliveries.update(deliveryId, (row) => ({
        ...row,
        status: "SENT",
        providerMessageId: delivery?.providerMessageId ?? null,
        updatedAt: isoNow(),
      }));
      increment(METRIC.emailsSent);
    } catch (error) {
      await deliveries.update(deliveryId, (row) => ({
        ...row,
        status: "FAILED",
        errorCode: isAppError(error) ? error.code : "DELIVERY_FAILED",
        updatedAt: isoNow(),
      }));
      increment(METRIC.deliveryFailed);
      throw error;
    }
  } else {
    // Demo mode: record a clearly-labelled simulated delivery.
    await deliveries.create({
      id: deliveryId,
      leadId: lead.id,
      toEmail: lead.contact.workEmail,
      subject: lead.draft.subject,
      provider: "demo",
      status: "SIMULATED",
      providerMessageId: null,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  const sendStep = getStep(lead.workflow, "send");
  const next: Lead = {
    ...lead,
    status: "SENT",
    updatedAt: now,
    lastActivityAt: now,
    draft: { ...lead.draft, status: "SENT" },
  };
  next.workflow = withStep(next.workflow, "send", "SUCCEEDED", {
    attempt: (sendStep?.attempt ?? 0) + 1,
    startedAt: now,
    completedAt: now,
    durationMs: 0,
    errorCode: null,
    errorMessage: null,
  });
  next.workflow.currentStage = currentStageFrom(next.workflow);

  const saved = await persist(next);
  await record(
    "lead.sent",
    emailProvider.enabled
      ? `Message to ${saved.company.name} was sent via ${emailProvider.name}.`
      : `Message to ${saved.company.name} was simulated (demo delivery).`,
    saved,
  );

  return { lead: saved, delivery };
}
