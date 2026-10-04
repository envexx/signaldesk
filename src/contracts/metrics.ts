/** Read model for `GET /api/metrics`. */

export interface MetricsSnapshot {
  counters: Record<string, number>;
  enrichment: {
    samples: number;
    medianMs: number | null;
    p95Ms: number | null;
  };
  rates: {
    enrichmentSuccessRate: number | null;
    draftApprovalRate: number | null;
    leadToApprovedConversion: number | null;
    deliveryFailureRate: number | null;
  };
  generatedAt: string;
}
