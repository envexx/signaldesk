import "server-only";

import type { ActivityEvent, Lead } from "@/contracts";

import { getStep } from "./workflow";

const ATTENTION_LIMIT = 5;
const ACTIVITY_FEED_LIMIT = 8;

const ATTENTION_STATUSES: Lead["status"][] = [
  "READY_FOR_REVIEW",
  "FAILED",
  "PROCESSING",
  "CAPTURED",
  "APPROVED",
];

const QUEUE_STATUS_PRIORITY: Partial<Record<Lead["status"], number>> = {
  READY_FOR_REVIEW: 0,
  FAILED: 1,
  PROCESSING: 2,
  CAPTURED: 3,
  APPROVED: 4,
};

/** Pre-aggregated dashboard read model shared by every repository adapter. */
export interface DashboardAggregate {
  totalLeads: number;
  highPriorityLeads: number;
  enrichmentDurationsMs: number[];
  draftsAwaitingApproval: number;
  funnel: {
    captured: number;
    enriched: number;
    qualified: number;
    approved: number;
  };
  attentionLeads: Lead[];
  recentActivity: ActivityEvent[];
}

export function buildDashboardAggregate(
  leads: Lead[],
  activity: ActivityEvent[],
): DashboardAggregate {
  let highPriorityLeads = 0;
  let draftsAwaitingApproval = 0;
  let enriched = 0;
  let qualified = 0;
  let approved = 0;
  const enrichmentDurationsMs: number[] = [];

  for (const lead of leads) {
    const tier = lead.qualification.tier;
    if (tier === "HIGH_PRIORITY") highPriorityLeads += 1;
    if (tier === "HIGH_PRIORITY" || tier === "MEDIUM") qualified += 1;
    if (lead.status === "READY_FOR_REVIEW" && lead.draft.status === "DRAFT") {
      draftsAwaitingApproval += 1;
    }
    if (lead.status === "APPROVED" || lead.status === "SENT") approved += 1;
    if (getStep(lead.workflow, "research")?.status === "SUCCEEDED") {
      enriched += 1;
    }
    if (lead.workflow.processingDurationMs !== null) {
      enrichmentDurationsMs.push(lead.workflow.processingDurationMs);
    }
  }

  const attentionLeads = leads
    .filter((lead) => ATTENTION_STATUSES.includes(lead.status))
    .sort((a, b) => {
      const priorityA = QUEUE_STATUS_PRIORITY[a.status] ?? 9;
      const priorityB = QUEUE_STATUS_PRIORITY[b.status] ?? 9;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return b.qualification.score - a.qualification.score;
    })
    .slice(0, ATTENTION_LIMIT);

  return {
    totalLeads: leads.length,
    highPriorityLeads,
    enrichmentDurationsMs,
    draftsAwaitingApproval,
    funnel: {
      captured: leads.length,
      enriched,
      qualified,
      approved,
    },
    attentionLeads,
    recentActivity: activity.slice(0, ACTIVITY_FEED_LIMIT),
  };
}
