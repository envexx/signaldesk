/**
 * API response envelope and read-model contracts shared with the frontend.
 */

import type { LeadStatus, Tier } from "./lead";

export type ApiMeta = Record<string, unknown>;

export interface ApiSuccess<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorFieldMap {
  [field: string]: string[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: ApiErrorFieldMap;
}

export interface ApiError {
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface LeadListMeta {
  total: number;
  count: number;
  limit: number;
  offset: number;
  filters: {
    q: string | null;
    tier: Tier | null;
    status: LeadStatus | null;
  };
}

export interface DashboardKpis {
  totalLeads: number;
  highPriorityLeads: number;
  medianEnrichmentTimeMs: number | null;
  draftsAwaitingApproval: number;
}

export interface PriorityQueueItem {
  id: string;
  fullName: string;
  workEmail: string;
  companyName: string;
  score: number;
  tier: Tier;
  status: LeadStatus;
  createdAt: string;
  ageMs: number;
}

export const FUNNEL_STAGE_KEYS = [
  "CAPTURED",
  "ENRICHED",
  "QUALIFIED",
  "APPROVED",
] as const;

export type FunnelStageKey = (typeof FUNNEL_STAGE_KEYS)[number];

export interface FunnelStage {
  key: FunnelStageKey;
  label: string;
  count: number;
}

export const AUTOMATION_HEALTH_KEYS = [
  "webhook",
  "enrichment",
  "aiDrafting",
  "emailDelivery",
] as const;

export type AutomationHealthKey = (typeof AUTOMATION_HEALTH_KEYS)[number];

export type AutomationHealthStatus = "operational" | "degraded" | "offline";

export interface AutomationHealthItem {
  key: AutomationHealthKey;
  label: string;
  status: AutomationHealthStatus;
  detail: string;
}

export const ACTIVITY_KINDS = [
  "lead.captured",
  "webhook.received",
  "workflow.started",
  "workflow.completed",
  "workflow.failed",
  "draft.approved",
  "draft.rejected",
  "lead.sent",
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  message: string;
  leadId: string | null;
  companyName: string | null;
  tier: Tier | null;
  occurredAt: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  priorityQueue: PriorityQueueItem[];
  funnel: FunnelStage[];
  automationHealth: AutomationHealthItem[];
  activityFeed: ActivityEvent[];
  generatedAt: string;
}

export interface HealthProviderStatus {
  name: string;
  mode: "demo" | "production";
  enabled: boolean;
  credentialsPresent: boolean;
}

export interface HealthData {
  status: "ok" | "degraded";
  mode: "demo" | "production";
  timestamp: string;
  uptimeMs: number;
  leadCount: number;
  providers: HealthProviderStatus[];
  infrastructure: {
    database: boolean;
    redis: boolean;
    inngest: boolean;
  };
  /** Present when production is missing required configuration. */
  missingConfiguration?: string[];
}
