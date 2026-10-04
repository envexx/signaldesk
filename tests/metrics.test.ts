import { beforeEach, describe, expect, it } from "vitest";

import {
  METRIC,
  increment,
  observeEnrichmentDuration,
  percentile,
  resetMetrics,
  snapshotMetrics,
} from "@/lib/server/observability/metrics";

beforeEach(() => {
  resetMetrics();
});

describe("percentile", () => {
  it("returns the nearest rank and null for empty input", () => {
    expect(percentile([10, 20, 30, 40, 50], 95)).toBe(50);
    expect(percentile([10, 20, 30, 40, 50], 50)).toBe(30);
    expect(percentile([], 95)).toBeNull();
  });
});

describe("metrics snapshot", () => {
  it("computes latency and rate metrics from counters", () => {
    increment(METRIC.leadsIngested, 4);
    increment(METRIC.enrichmentSucceeded, 3);
    increment(METRIC.enrichmentFailed, 1);
    increment(METRIC.draftsApproved, 2);
    increment(METRIC.emailsSent, 2);
    increment(METRIC.deliveryFailed, 1);
    observeEnrichmentDuration(100);
    observeEnrichmentDuration(200);
    observeEnrichmentDuration(300);

    const snapshot = snapshotMetrics();

    expect(snapshot.enrichment.samples).toBe(3);
    expect(snapshot.enrichment.medianMs).toBe(200);
    expect(snapshot.enrichment.p95Ms).toBe(300);
    expect(snapshot.rates.enrichmentSuccessRate).toBe(0.75);
    expect(snapshot.rates.draftApprovalRate).toBeCloseTo(0.6667, 3);
    expect(snapshot.rates.leadToApprovedConversion).toBe(0.5);
    expect(snapshot.rates.deliveryFailureRate).toBeCloseTo(0.3333, 3);
  });
});
