/**
 * Single centralized SignalDesk API client.
 *
 * Components must never build URLs or parse the response envelope themselves —
 * they call these functions and receive canonical `@/contracts` types.
 */

import type {
  ApproveLeadPayload,
  ApiErrorBody,
  ApiSuccess,
  CreateLeadInput,
  DashboardData,
  DeliveryRecord,
  HealthData,
  Lead,
  MetricsSnapshot,
  SettingsPayload,
  Tier,
  LeadStatus,
  WorkspaceSettings,
} from "@/contracts";

export class SignalDeskApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string[]>;

  constructor(
    code: string,
    message: string,
    status: number,
    fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "SignalDeskApiError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      cache: "no-store",
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new SignalDeskApiError(
      "REQUEST_FAILED",
      error instanceof Error ? error.message : "Network request failed",
      0,
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || (body !== null && typeof body === "object" && "error" in body)) {
    const errorBody = (body as { error?: ApiErrorBody } | null)?.error;
    throw new SignalDeskApiError(
      errorBody?.code ?? "REQUEST_FAILED",
      errorBody?.message ?? `Request failed with status ${response.status}`,
      response.status,
      errorBody?.fields,
    );
  }

  return (body as ApiSuccess<T>).data;
}

export interface LeadListParams {
  q?: string;
  tier?: Tier;
  status?: LeadStatus;
  limit?: number;
  offset?: number;
}

function query(params: LeadListParams = {}): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.tier) search.set("tier", params.tier);
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  const value = search.toString();
  return value ? `?${value}` : "";
}

export function listLeads(params: LeadListParams = {}): Promise<Lead[]> {
  return request<Lead[]>(`/api/leads${query(params)}`);
}

export function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>("/api/dashboard");
}

export function getLead(id: string): Promise<Lead> {
  return request<Lead>(`/api/leads/${encodeURIComponent(id)}`);
}

export function createLead(
  input: CreateLeadInput,
): Promise<Lead> {
  return request<Lead>("/api/leads", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateLeadDraft(
  id: string,
  draft: { subject?: string; body?: string },
): Promise<Lead> {
  return request<Lead>(`/api/leads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ draft }),
  });
}

export function processLead(id: string, force = false): Promise<Lead> {
  return request<Lead>(`/api/leads/${encodeURIComponent(id)}/process`, {
    method: "POST",
    body: JSON.stringify({ force }),
  });
}

export function approveLead(
  id: string,
  payload: ApproveLeadPayload,
): Promise<Lead> {
  return request<Lead>(`/api/leads/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function rejectLead(id: string): Promise<Lead> {
  return request<Lead>(`/api/leads/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function sendLead(id: string): Promise<Lead> {
  return request<Lead>(`/api/leads/${encodeURIComponent(id)}/send`, {
    method: "POST",
    body: JSON.stringify({ confirm: true }),
  });
}

export function getSettings(): Promise<WorkspaceSettings> {
  return request<WorkspaceSettings>("/api/settings");
}

export function updateSettings(
  payload: SettingsPayload,
): Promise<WorkspaceSettings> {
  return request<WorkspaceSettings>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getMetrics(): Promise<MetricsSnapshot> {
  return request<MetricsSnapshot>("/api/metrics");
}

export function getHealth(): Promise<HealthData> {
  return request<HealthData>("/api/health");
}

export interface EmailTestResult {
  mode: "demo" | "resend";
  sent: boolean;
  to: string;
  messageId?: string;
  message?: string;
}

export function testEmail(to?: string): Promise<EmailTestResult> {
  return request<EmailTestResult>("/api/settings/email/test", {
    method: "POST",
    body: JSON.stringify(to ? { to } : {}),
  });
}

export function listOutbox(limit = 50): Promise<DeliveryRecord[]> {
  return request<DeliveryRecord[]>(`/api/outbox?limit=${limit}`);
}

export function seedDemoWorkspace(): Promise<{ leads: number; activity: number }> {
  return request<{ leads: number; activity: number }>("/api/demo/seed", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function resetWorkspace(): Promise<{ cleared: boolean }> {
  return request<{ cleared: boolean }>("/api/demo/reset", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** Send one sample inbound lead through the real webhook endpoint. */
export function sendTestWebhook(): Promise<Lead> {
  const suffix = Math.random().toString(36).slice(2, 8);
  return request<Lead>("/api/webhooks/leads", {
    method: "POST",
    headers: { "Idempotency-Key": `test-webhook-${suffix}` },
    body: JSON.stringify({
      fullName: "Webhook Test Lead",
      workEmail: `webhook.test.${suffix}@example.com`,
      companyWebsite: "example.com",
      companyName: "Webhook Test Co",
      source: "webhook",
    }),
  });
}
