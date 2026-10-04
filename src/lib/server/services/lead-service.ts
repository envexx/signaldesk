import "server-only";

import type {
  ActivityEvent,
  ActivityKind,
  AutomationHealthItem,
  CompanyProfile,
  ContactIdentity,
  DashboardData,
  DashboardKpis,
  FunnelStage,
  Lead,
  PriorityQueueItem,
} from "@/contracts";
import { companyNameFromDomain, normalizeEmail, normalizeWebsite } from "@/contracts";
import type { LeadListQuery, UpdateLeadPayload } from "@/contracts";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/server/domain/errors";
import { newEventId, newLeadId } from "@/lib/server/domain/ids";
import { createLeadRecord } from "@/lib/server/domain/lead-factory";
import { isoNow, median } from "@/lib/server/domain/time";
import { currentStageFrom } from "@/lib/server/domain/workflow";
import { getProviderRegistry } from "@/lib/server/providers";
import { getLeadRepository } from "@/lib/server/repositories";
import { getResolvedEmailConfig } from "@/lib/server/services/settings-service";
import {
  lookupIdempotency,
  rememberIdempotency,
} from "@/lib/server/cache/idempotency";
import { METRIC, increment } from "@/lib/server/observability/metrics";

export interface LeadIntake {
  fullName: string;
  workEmail: string;
  companyWebsite: string;
  companyName?: string;
  role?: string;
  source?: string;
}

export interface CreateLeadOptions {
  source?: string;
  idempotencyKey?: string | null;
}

export interface LeadListResult {
  items: Lead[];
  total: number;
  limit: number;
  offset: number;
}

function normalizeIntake(
  intake: LeadIntake,
  fallbackSource: string,
): { contact: ContactIdentity; company: CompanyProfile } {
  const workEmail = normalizeEmail(intake.workEmail);
  const website = normalizeWebsite(intake.companyWebsite);
  if (!website) {
    throw new ValidationError("Company website is invalid", {
      companyWebsite: ["Enter a valid website, e.g. acme.com"],
    });
  }

  const name =
    intake.companyName?.trim() || companyNameFromDomain(website.domain);

  return {
    contact: {
      fullName: intake.fullName.trim(),
      workEmail,
      role: intake.role?.trim() || null,
      source: intake.source?.trim() || fallbackSource,
    },
    company: {
      name,
      domain: website.domain,
      website: website.website,
      industry: null,
      estimatedSize: null,
      businessModel: null,
      location: null,
    },
  };
}

async function recordActivity(input: {
  kind: ActivityKind;
  message: string;
  lead?: Lead;
  leadId?: string | null;
  companyName?: string | null;
  occurredAt?: string;
}): Promise<void> {
  const event: ActivityEvent = {
    id: newEventId(),
    kind: input.kind,
    message: input.message,
    leadId: input.lead?.id ?? input.leadId ?? null,
    companyName: input.lead?.company.name ?? input.companyName ?? null,
    tier:
      input.lead && input.lead.qualification.tier !== "UNASSESSED"
        ? input.lead.qualification.tier
        : null,
    occurredAt: input.occurredAt ?? isoNow(),
  };
  await getLeadRepository().addActivity(event);
}

export async function createLead(
  intake: LeadIntake,
  options: CreateLeadOptions = {},
): Promise<Lead> {
  const { contact, company } = normalizeIntake(
    intake,
    options.source ?? intake.source ?? "manual",
  );

  const lead = createLeadRecord({
    id: newLeadId(),
    contact,
    company,
    idempotencyKey: options.idempotencyKey ?? null,
  });

  await getLeadRepository().create(lead);
  increment(METRIC.leadsIngested);
  await recordActivity({
    kind: "lead.captured",
    message: `${contact.fullName} was captured from ${contact.source}.`,
    lead,
  });

  return lead;
}

export interface WebhookResult {
  lead: Lead;
  duplicate: boolean;
}

/**
 * Idempotent inbound webhook. A repeated `Idempotency-Key` returns the original
 * lead instead of creating a duplicate.
 */
export async function ingestWebhookLead(
  intake: LeadIntake,
  idempotencyKey: string | null,
): Promise<WebhookResult> {
  if (idempotencyKey) {
    // Fast cross-instance dedupe via Redis when configured.
    const cachedLeadId = await lookupIdempotency(idempotencyKey);
    if (cachedLeadId) {
      const cached = await getLeadRepository().getById(cachedLeadId);
      if (cached) {
        increment(METRIC.webhookDuplicates);
        return { lead: cached, duplicate: true };
      }
    }

    const existing = await getLeadRepository().getByIdempotencyKey(idempotencyKey);
    if (existing) {
      await rememberIdempotency(idempotencyKey, existing.id);
      increment(METRIC.webhookDuplicates);
      return { lead: existing, duplicate: true };
    }
  }

  const lead = await createLead(
    { ...intake, source: intake.source ?? "webhook" },
    { source: "webhook", idempotencyKey },
  );

  increment(METRIC.webhooksIngested);

  if (idempotencyKey) {
    await rememberIdempotency(idempotencyKey, lead.id);
  }

  await recordActivity({
    kind: "webhook.received",
    message: `Inbound webhook captured ${lead.contact.fullName} (${lead.company.name}).`,
    lead,
  });

  return { lead, duplicate: false };
}

export async function listLeads(query: LeadListQuery): Promise<LeadListResult> {
  const matched = await getLeadRepository().list({
    q: query.q,
    tier: query.tier,
    status: query.status,
  });
  const items = matched.slice(query.offset, query.offset + query.limit);
  return {
    items,
    total: matched.length,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getLeadById(id: string): Promise<Lead> {
  const lead = await getLeadRepository().getById(id);
  if (!lead) throw new NotFoundError();
  return lead;
}

export async function updateLead(
  id: string,
  patch: UpdateLeadPayload,
): Promise<Lead> {
  const existing = await getLeadRepository().getById(id);
  if (!existing) throw new NotFoundError();

  if (existing.status === "SENT" && patch.draft) {
    throw new ConflictError("A sent message can no longer be edited.");
  }

  const updated = await getLeadRepository().update(id, (lead) => {
    const now = isoNow();
    const next: Lead = { ...lead, updatedAt: now, lastActivityAt: now };

    if (patch.fullName) {
      next.contact = { ...next.contact, fullName: patch.fullName.trim() };
    }
    if (patch.workEmail) {
      next.contact = { ...next.contact, workEmail: normalizeEmail(patch.workEmail) };
    }
    if (patch.role !== undefined) {
      next.contact = { ...next.contact, role: patch.role ?? null };
    }
    if (patch.source) {
      next.contact = { ...next.contact, source: patch.source };
    }
    if (patch.company) {
      next.company = { ...next.company, ...patch.company };
    }
    if (patch.draft) {
      const wasApproved = next.draft.status === "APPROVED";
      next.draft = {
        ...next.draft,
        subject: patch.draft.subject ?? next.draft.subject,
        body: patch.draft.body ?? next.draft.body,
        // An edit after approval returns the draft to review state.
        status: wasApproved ? "DRAFT" : next.draft.status,
        version: next.draft.version + 1,
        lastEditedAt: now,
      };

      if (wasApproved) {
        next.status = "READY_FOR_REVIEW";
        next.workflow = {
          ...next.workflow,
          steps: next.workflow.steps.map((step) =>
            step.key === "approve"
              ? {
                  ...step,
                  status: "PENDING" as const,
                  completedAt: null,
                  durationMs: null,
                  errorCode: null,
                  errorMessage: null,
                }
              : step,
          ),
        };
        next.workflow.currentStage = currentStageFrom(next.workflow);
      }
    }

    return next;
  });

  if (!updated) throw new NotFoundError();
  return updated;
}

function toQueueItem(lead: Lead, nowIso: string): PriorityQueueItem {
  return {
    id: lead.id,
    fullName: lead.contact.fullName,
    workEmail: lead.contact.workEmail,
    companyName: lead.company.name,
    score: lead.qualification.score,
    tier: lead.qualification.tier,
    status: lead.status,
    createdAt: lead.createdAt,
    ageMs: Math.max(
      0,
      new Date(nowIso).getTime() - new Date(lead.createdAt).getTime(),
    ),
  };
}

async function buildAutomationHealth(): Promise<AutomationHealthItem[]> {
  const registry = getProviderRegistry();
  const email = await getResolvedEmailConfig();
  return [
    {
      key: "webhook",
      label: "Inbound webhook",
      status: "operational",
      detail: "Listening for inbound lead webhooks.",
    },
    {
      key: "enrichment",
      label: "Enrichment workflow",
      status: "operational",
      detail:
        registry.mode === "demo"
          ? "Deterministic demo pipeline (no external calls)."
          : registry.research.name,
    },
    {
      key: "aiDrafting",
      label: "AI drafting",
      status: "operational",
      detail:
        registry.intelligence.mode === "demo"
          ? "Deterministic demo drafting."
          : registry.intelligence.name,
    },
    {
      key: "emailDelivery",
      label: "Email delivery",
      status: email.enabled ? "operational" : "degraded",
      detail: email.enabled
        ? `Resend · ${email.fromEmail}`
        : "Demo mode — configure Resend in Settings.",
    },
  ];
}

export async function getDashboard(): Promise<DashboardData> {
  const aggregate = await getLeadRepository().aggregateDashboard();
  const nowIso = isoNow();

  const kpis: DashboardKpis = {
    totalLeads: aggregate.totalLeads,
    highPriorityLeads: aggregate.highPriorityLeads,
    medianEnrichmentTimeMs: median(aggregate.enrichmentDurationsMs),
    draftsAwaitingApproval: aggregate.draftsAwaitingApproval,
  };

  const funnel: FunnelStage[] = [
    { key: "CAPTURED", label: "Captured", count: aggregate.funnel.captured },
    { key: "ENRICHED", label: "Enriched", count: aggregate.funnel.enriched },
    { key: "QUALIFIED", label: "Qualified", count: aggregate.funnel.qualified },
    { key: "APPROVED", label: "Approved", count: aggregate.funnel.approved },
  ];

  const priorityQueue = aggregate.attentionLeads.map((lead) =>
    toQueueItem(lead, nowIso),
  );

  return {
    kpis,
    priorityQueue,
    funnel,
    automationHealth: await buildAutomationHealth(),
    activityFeed: aggregate.recentActivity,
    generatedAt: nowIso,
  };
}

/** Counts used by the health endpoint. */
export async function countLeads(): Promise<number> {
  return getLeadRepository().count();
}
