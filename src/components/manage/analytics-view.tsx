"use client";

import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Gauge,
  PieChart,
  Target,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useApiStore } from "@/components/providers/api-store";
import { PageLoading } from "@/components/ui/page-loading";
import type { MetricsSnapshot } from "@/contracts";
import { getMetrics } from "@/lib/client/signaldesk-api";
import { tierLabels, type LeadTier } from "@/lib/demo/types";

type RangeDays = 7 | 30 | 90;

const RANGE_OPTIONS: Array<{ label: string; value: RangeDays }> = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

const tierOrder: LeadTier[] = [
  "HIGH_PRIORITY",
  "MEDIUM",
  "DISQUALIFIED",
  "UNASSESSED",
];

function percent(rate: number | null): string {
  return rate == null ? "—" : `${Math.round(rate * 100)}%`;
}

function ms(value: number | null): string {
  return value == null ? "—" : `${(value / 1000).toFixed(1)}s`;
}

export function AnalyticsView() {
  const { leads, dashboard, hydrated } = useApiStore();
  const [range, setRange] = useState<RangeDays>(7);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);

  useEffect(() => {
    getMetrics()
      .then(setMetrics)
      .catch(() => setMetrics(null));
  }, []);

  const analytics = useMemo(() => {
    const enriched = leads.filter((lead) => lead.qualification.tier !== "UNASSESSED");
    const qualified = leads.filter((lead) =>
      ["HIGH_PRIORITY", "MEDIUM"].includes(lead.qualification.tier),
    );
    const approved = leads.filter((lead) =>
      ["APPROVED", "SENT"].includes(lead.status),
    );
    const processingTimes = leads
      .map((lead) => lead.processingDurationMs)
      .filter((duration): duration is number => typeof duration === "number")
      .sort((a, b) => a - b);

    const sources = new Map<string, { count: number; qualified: number }>();
    for (const lead of leads) {
      const current = sources.get(lead.source) ?? { count: 0, qualified: 0 };
      current.count += 1;
      if (["HIGH_PRIORITY", "MEDIUM"].includes(lead.qualification.tier)) {
        current.qualified += 1;
      }
      sources.set(lead.source, current);
    }

    return {
      enrichedRate: leads.length ? (enriched.length / leads.length) * 100 : 0,
      qualifiedRate: leads.length ? (qualified.length / leads.length) * 100 : 0,
      approvalRate: qualified.length ? (approved.length / qualified.length) * 100 : 0,
      medianMs:
        dashboard?.kpis.medianEnrichmentTimeMs ??
        processingTimes[Math.floor(processingTimes.length / 2)] ??
        0,
      p95Ms:
        processingTimes.length > 0
          ? processingTimes[
              Math.min(
                processingTimes.length - 1,
                Math.ceil(0.95 * processingTimes.length) - 1,
              )
            ] ?? 0
          : 0,
      tiers: tierOrder.map((tier) => ({
        tier,
        count: leads.filter((lead) => lead.qualification.tier === tier).length,
      })),
      sources: [...sources.entries()]
        .map(([name, values]) => ({ name, ...values }))
        .sort((a, b) => b.count - a.count),
    };
  }, [dashboard, leads]);

  const volume = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- current time anchors the volume window
    const now = Date.now();
    const dayMs = 86_400_000;
    const useWeeks = range > 14;
    const spanDays = useWeeks ? 7 : 1;
    const bucketCount = Math.ceil(range / spanDays);
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const ageFrom = (bucketCount - 1 - index) * spanDays;
      const start = new Date(now - ageFrom * dayMs);
      const label = useWeeks
        ? start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : start.toLocaleDateString("en-US", { weekday: "short" });
      return { label, captured: 0, qualified: 0 };
    });

    for (const lead of leads) {
      const ageDays = (now - new Date(lead.createdAt).getTime()) / dayMs;
      if (ageDays < 0 || ageDays >= range) continue;
      const index = bucketCount - 1 - Math.floor(ageDays / spanDays);
      const bucket = buckets[index];
      if (!bucket) continue;
      bucket.captured += 1;
      if (["HIGH_PRIORITY", "MEDIUM"].includes(lead.qualification.tier)) {
        bucket.qualified += 1;
      }
    }
    return buckets;
  }, [leads, range]);

  if (!hydrated) return <PageLoading />;

  const maxVolume = Math.max(1, ...volume.map((item) => item.captured));
  const axisTop = Math.max(5, Math.ceil(maxVolume / 5) * 5);
  const axisTicks = [
    axisTop,
    Math.round((axisTop * 2) / 3),
    Math.round(axisTop / 3),
    0,
  ];

  return (
    <div className="manage-page">
      <section className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Growth intelligence</p>
          <h1>Analytics</h1>
          <p>Measure qualification efficiency, response speed, and pipeline quality.</p>
        </div>
        <div className="analytics-range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={range === option.value ? "analytics-range__active" : ""}
              type="button"
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="manage-metric-grid manage-metric-grid--four" aria-label="Growth metrics">
        <article className="manage-metric-card">
          <span><Target size={17} /></span>
          <div><small>Qualification rate</small><strong>{analytics.qualifiedRate.toFixed(1)}%</strong></div>
          <em>{leads.length} leads scored</em>
        </article>
        <article className="manage-metric-card">
          <span><CheckCircle2 size={17} /></span>
          <div><small>Approval rate</small><strong>{analytics.approvalRate.toFixed(1)}%</strong></div>
          <em>of qualified leads</em>
        </article>
        <article className="manage-metric-card">
          <span><Clock3 size={17} /></span>
          <div><small>Median enrichment</small><strong>{(analytics.medianMs / 1000).toFixed(1)}s</strong></div>
          <em>p95 {(analytics.p95Ms / 1000).toFixed(1)}s</em>
        </article>
        <article className="manage-metric-card">
          <span><Gauge size={17} /></span>
          <div><small>Enrichment coverage</small><strong>{analytics.enrichedRate.toFixed(1)}%</strong></div>
          <em>Evidence-backed profiles</em>
        </article>
      </section>

      <section className="analytics-grid">
        <article className="panel volume-chart-card">
          <div className="panel__header">
            <div>
              <p className="panel-kicker">Inbound performance</p>
              <h2>Lead volume & qualification</h2>
            </div>
            <div className="chart-legend"><span><i /> Captured</span><span><i /> Qualified</span></div>
          </div>
          <div className="volume-chart" role="img" aria-label="Lead volume and qualified leads for the last seven days">
            <div className="volume-chart__axis">{axisTicks.map((tick) => (<span key={tick}>{tick}</span>))}</div>
            <div className="volume-chart__plot">
              {volume.map((item) => (
                <div className="volume-column" key={item.label}>
                  <div className="volume-column__bars">
                    <span style={{ height: `${(item.captured / maxVolume) * 100}%` }} />
                    <span style={{ height: `${(item.qualified / maxVolume) * 100}%` }} />
                  </div>
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="panel tier-breakdown-card">
          <div className="panel__header">
            <div>
              <p className="panel-kicker">Pipeline composition</p>
              <h2>Qualification tiers</h2>
            </div>
            <PieChart size={19} />
          </div>
          <div className="tier-breakdown-ring" aria-label="Qualification tier distribution">
            <div><strong>{leads.length}</strong><small>Total leads</small></div>
          </div>
          <div className="tier-breakdown-list">
            {analytics.tiers.map(({ tier, count }) => (
              <div key={tier}>
                <span><i className={`tier-dot tier-dot--${tier.toLowerCase()}`} /> {tierLabels[tier]}</span>
                <strong>{count}</strong>
                <small>{leads.length ? Math.round((count / leads.length) * 100) : 0}%</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel source-performance-card">
        <div className="panel__header">
          <div>
            <p className="panel-kicker">Acquisition quality</p>
            <h2>Source performance</h2>
          </div>
          <span className="trend-chip"><TrendingUp size={13} /> Live pipeline data</span>
        </div>
        <div className="source-performance-table">
          <div className="source-performance-table__head">
            <span>Source</span><span>Leads</span><span>Qualified</span><span>Conversion</span><span>Contribution</span>
          </div>
          {analytics.sources.length ? analytics.sources.map((source) => {
            const conversion = source.count ? (source.qualified / source.count) * 100 : 0;
            return (
              <div className="source-performance-row" key={source.name}>
                <strong><BarChart3 size={14} /> {source.name}</strong>
                <span>{source.count}</span>
                <span>{source.qualified}</span>
                <span>{conversion.toFixed(0)}%</span>
                <div><i style={{ width: `${conversion}%` }} /></div>
              </div>
            );
          }) : (
            <div className="analytics-empty">Source data will appear when leads enter the pipeline.</div>
          )}
        </div>
      </section>

      <section className="panel source-performance-card">
        <div className="panel__header">
          <div>
            <p className="panel-kicker">System</p>
            <h2>Operational metrics</h2>
          </div>
          <Gauge size={19} />
        </div>
        {metrics ? (
          <div className="system-status-list">
            {[
              {
                label: "Leads ingested",
                value: String(metrics.counters.leads_ingested ?? 0),
              },
              {
                label: "Enrichment success rate",
                value: percent(metrics.rates.enrichmentSuccessRate),
              },
              {
                label: "Median enrichment",
                value: ms(metrics.enrichment.medianMs),
              },
              { label: "p95 enrichment", value: ms(metrics.enrichment.p95Ms) },
              {
                label: "Delivery failure rate",
                value: percent(metrics.rates.deliveryFailureRate),
              },
              {
                label: "Lead → approved conversion",
                value: percent(metrics.rates.leadToApprovedConversion),
              },
            ].map((row) => (
              <div className="system-status-row" key={row.label}>
                <div>
                  <strong>{row.label}</strong>
                </div>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-copy">Loading metrics…</p>
        )}
      </section>
    </div>
  );
}

