import "server-only";

import type { MetricsSnapshot } from "@/contracts";

/**
 * Lightweight in-process metrics registry (counters + latency histogram).
 * Exposed via `GET /api/metrics`. For multi-instance production, scrape this
 * endpoint per instance or forward to your APM.
 */
interface MetricsState {
  counters: Record<string, number>;
  enrichmentDurationsMs: number[];
}

const GLOBAL_KEY = "__signaldeskMetrics__";

const globalForMetrics = globalThis as typeof globalThis & {
  [GLOBAL_KEY]?: MetricsState;
};

const MAX_SAMPLES = 1_000;

function state(): MetricsState {
  if (!globalForMetrics[GLOBAL_KEY]) {
    globalForMetrics[GLOBAL_KEY] = { counters: {}, enrichmentDurationsMs: [] };
  }
  return globalForMetrics[GLOBAL_KEY];
}

export const METRIC = {
  leadsIngested: "leads_ingested",
  webhooksIngested: "webhooks_ingested",
  webhookDuplicates: "webhook_duplicates",
  enrichmentSucceeded: "enrichment_succeeded",
  enrichmentFailed: "enrichment_failed",
  draftsApproved: "drafts_approved",
  emailsSent: "emails_sent",
  deliveryFailed: "delivery_failed",
} as const;

export function increment(metric: string, by = 1): void {
  const current = state();
  current.counters[metric] = (current.counters[metric] ?? 0) + by;
}

export function observeEnrichmentDuration(durationMs: number): void {
  const current = state();
  current.enrichmentDurationsMs.push(durationMs);
  if (current.enrichmentDurationsMs.length > MAX_SAMPLES) {
    current.enrichmentDurationsMs.splice(
      0,
      current.enrichmentDurationsMs.length - MAX_SAMPLES,
    );
  }
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10_000) / 10_000;
}

export function snapshotMetrics(): MetricsSnapshot {
  const current = state();
  const counters = { ...current.counters };
  const durations = current.enrichmentDurationsMs;

  const succeeded = counters[METRIC.enrichmentSucceeded] ?? 0;
  const failed = counters[METRIC.enrichmentFailed] ?? 0;
  const approved = counters[METRIC.draftsApproved] ?? 0;
  const sent = counters[METRIC.emailsSent] ?? 0;
  const deliveryFailed = counters[METRIC.deliveryFailed] ?? 0;
  const ingested = counters[METRIC.leadsIngested] ?? 0;

  return {
    counters,
    enrichment: {
      samples: durations.length,
      medianMs: median(durations),
      p95Ms: percentile(durations, 95),
    },
    rates: {
      enrichmentSuccessRate: ratio(succeeded, succeeded + failed),
      draftApprovalRate: ratio(approved, succeeded),
      leadToApprovedConversion: ratio(approved, ingested),
      deliveryFailureRate: ratio(deliveryFailed, sent + deliveryFailed),
    },
    generatedAt: new Date().toISOString(),
  };
}

/** Test helper: reset the registry. */
export function resetMetrics(): void {
  globalForMetrics[GLOBAL_KEY] = { counters: {}, enrichmentDurationsMs: [] };
}
