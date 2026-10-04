"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Gauge,
  Inbox,
  ScanSearch,
  TimerReset,
  TrendingUp,
  UserRoundCheck,
  Users,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useApiStore } from "@/components/providers/api-store";
import { PageLoading } from "@/components/ui/page-loading";
import { ScoreRing } from "@/components/ui/score-ring";
import { TierPill } from "@/components/ui/status-pill";

function relativeTime(iso: string) {
  const reference = Date.now();
  const minutes = Math.max(1, Math.round((reference - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function activityVisual(kind: string): {
  icon: typeof ScanSearch;
  tone: string;
} {
  switch (kind) {
    case "workflow.failed":
    case "draft.rejected":
      return { icon: TimerReset, tone: "danger" };
    case "workflow.completed":
    case "draft.approved":
    case "lead.sent":
      return { icon: CheckCircle2, tone: "success" };
    case "webhook.received":
    case "workflow.started":
      return { icon: Zap, tone: "brand" };
    default:
      return { icon: ScanSearch, tone: "brand" };
  }
}

export function DashboardView() {
  const { leads, dashboard, hydrated, seedDemo } = useApiStore();
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDemo();
    } finally {
      setSeeding(false);
    }
  };

  const metrics = useMemo(() => {
    if (dashboard) {
      return {
        total: dashboard.kpis.totalLeads,
        priority: dashboard.kpis.highPriorityLeads,
        review: dashboard.kpis.draftsAwaitingApproval,
        median:
          dashboard.kpis.medianEnrichmentTimeMs != null
            ? `${(dashboard.kpis.medianEnrichmentTimeMs / 1000).toFixed(1)}s`
            : "0.0s",
      };
    }

    const processingTimes = leads
      .map((lead) => lead.processingDurationMs)
      .filter((value): value is number => typeof value === "number")
      .sort((a, b) => a - b);
    const middle = processingTimes[Math.floor(processingTimes.length / 2)] || 0;

    return {
      total: leads.length,
      priority: leads.filter((lead) => lead.qualification.tier === "HIGH_PRIORITY")
        .length,
      review: leads.filter(
        (lead) =>
          lead.status === "READY_FOR_REVIEW" && lead.draft.status === "DRAFT",
      ).length,
      median: `${(middle / 1000).toFixed(1)}s`,
    };
  }, [dashboard, leads]);

  if (!hydrated) return <PageLoading />;

  const priorityLeads = [...leads]
    .filter((lead) => lead.qualification.tier !== "DISQUALIFIED")
    .sort((a, b) => b.qualification.score - a.qualification.score)
    .slice(0, 4);

  const funnelCount = (
    key: "CAPTURED" | "ENRICHED" | "QUALIFIED" | "APPROVED",
    fallback: number,
  ) => dashboard?.funnel.find((stage) => stage.key === key)?.count ?? fallback;

  const funnel = [
    { label: "Captured", value: funnelCount("CAPTURED", leads.length), icon: Inbox },
    {
      label: "Enriched",
      value: funnelCount(
        "ENRICHED",
        leads.filter((lead) => lead.qualification.tier !== "UNASSESSED").length,
      ),
      icon: Bot,
    },
    {
      label: "Qualified",
      value: funnelCount(
        "QUALIFIED",
        leads.filter((lead) =>
          ["HIGH_PRIORITY", "MEDIUM"].includes(lead.qualification.tier),
        ).length,
      ),
      icon: UserRoundCheck,
    },
    {
      label: "Approved",
      value: funnelCount(
        "APPROVED",
        leads.filter((lead) => ["APPROVED", "SENT"].includes(lead.status))
          .length,
      ),
      icon: CheckCircle2,
    },
  ];

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const captured =
    dashboard?.funnel.find((stage) => stage.key === "CAPTURED")?.count ??
    leads.length;
  const approvedCount =
    dashboard?.funnel.find((stage) => stage.key === "APPROVED")?.count ?? 0;
  const approvalRate =
    captured > 0 ? Math.round((approvedCount / captured) * 100) : 0;
  const automation = dashboard?.automationHealth ?? [];
  const automationHealthy =
    automation.length > 0 &&
    automation.every((item) => item.status === "operational");

  return (
    <div className="dashboard-page">
      <section className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">{dateLabel}</p>
          <h1>{greeting}, Nadia.</h1>
          <p>
            Your inbound engine found <strong>{metrics.priority} priority leads</strong>{" "}
            worth a closer look.
          </p>
        </div>
        <div className="demo-badge">
          <span>Live demo</span>
          Backend API connected
        </div>
      </section>

      {metrics.total === 0 && (
        <section className="panel onboarding-card">
          <p className="panel-kicker">Get started</p>
          <h2>Your workspace is empty</h2>
          <p>
            Enrich a real company website, or load a sample workspace to see the
            full flow instantly.
          </p>
          <div className="onboarding-actions">
            <Link className="button button--primary" href="/leads/new">
              Enrich your first lead <ArrowRight size={15} />
            </Link>
            <button
              className="button button--secondary"
              type="button"
              disabled={seeding}
              onClick={() => void handleSeed()}
            >
              {seeding ? "Loading…" : "Load sample workspace"}
            </button>
          </div>
          <p className="muted-copy">
            Try a domain like stripe.com, linear.app, or notion.so.
          </p>
        </section>
      )}

      <section className="metric-grid" aria-label="Lead metrics">
        <article className="metric-card metric-card--ink">
          <div className="metric-card__topline">
            <span>Inbound leads</span>
            <span className="metric-icon"><Users size={17} /></span>
          </div>
          <strong>{metrics.total}</strong>
          <div className="metric-card__footer">
            <span className="metric-caption">Live workspace data</span>
          </div>
          <div className="spark-bars" aria-hidden="true">
            {[35, 46, 42, 61, 53, 76, 84].map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-card__topline">
            <span>High priority</span>
            <span className="metric-icon metric-icon--lime"><Zap size={17} /></span>
          </div>
          <strong>{metrics.priority}</strong>
          <div className="metric-card__footer">
            <span className="metric-caption">{Math.round((metrics.priority / metrics.total) * 100)}% of pipeline</span>
          </div>
          <div className="mini-progress" aria-hidden="true">
            <span style={{ width: `${(metrics.priority / metrics.total) * 100}%` }} />
          </div>
        </article>

        <article className="metric-card">
          <div className="metric-card__topline">
            <span>Median enrichment</span>
            <span className="metric-icon metric-icon--blue"><Clock3 size={17} /></span>
          </div>
          <strong>{metrics.median}</strong>
          <div className="metric-card__footer">
            <span className="metric-caption">Across enriched leads</span>
          </div>
          <div className="latency-markers" aria-hidden="true">
            <span />
            <span />
            <span className="latency-markers__active" />
            <span />
            <span />
          </div>
        </article>

        <article className="metric-card metric-card--attention">
          <div className="metric-card__topline">
            <span>Awaiting approval</span>
            <span className="metric-icon metric-icon--amber"><FileCheck2 size={17} /></span>
          </div>
          <strong>{metrics.review}</strong>
          <div className="metric-card__footer">
            <span className="metric-caption">Human review required</span>
          </div>
          <Link className="metric-card__link" href="/leads">
            Review drafts <ArrowRight size={14} />
          </Link>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--primary">
        <article className="panel priority-panel">
          <div className="panel__header">
            <div>
              <p className="panel-kicker">Action queue</p>
              <h2>Priority leads</h2>
            </div>
            <Link className="text-link" href="/leads">
              View pipeline <ArrowRight size={14} />
            </Link>
          </div>
          <div className="priority-list">
            {priorityLeads.map((lead, index) => (
              <Link className="priority-row" href={`/leads/${lead.id}`} key={lead.id}>
                <span className="priority-row__rank">0{index + 1}</span>
                <span className={`avatar avatar--lead avatar--tone-${index + 1}`}>
                  {lead.initials}
                </span>
                <span className="priority-row__identity">
                  <strong>{lead.fullName}</strong>
                  <small>{lead.company.name} · {lead.role}</small>
                </span>
                <TierPill tier={lead.qualification.tier} />
                <ScoreRing score={lead.qualification.score} size="small" />
                <ArrowRight className="priority-row__arrow" size={17} />
              </Link>
            ))}
          </div>
        </article>

        <article className="panel funnel-panel">
          <div className="panel__header">
            <div>
              <p className="panel-kicker">Last 7 days</p>
              <h2>Conversion flow</h2>
            </div>
            <span className="trend-chip"><TrendingUp size={13} /> 12.4%</span>
          </div>
          <div className="funnel-stack">
            {funnel.map((stage, index) => {
              const Icon = stage.icon;
              const percent = Math.max(26, 100 - index * 18);
              return (
                <div className="funnel-stage" key={stage.label}>
                  <div className="funnel-stage__label">
                    <span><Icon size={15} /> {stage.label}</span>
                    <strong>{stage.value}</strong>
                  </div>
                  <div className="funnel-stage__bar">
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="funnel-insight">
            <Gauge size={18} />
            <p><strong>{approvalRate}% approval rate</strong><br />{approvedCount} of {captured} leads approved.</p>
          </div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--secondary">
        <article className="panel automation-panel">
          <div className="panel__header">
            <div>
              <p className="panel-kicker">Workflow monitor</p>
              <h2>Automation health</h2>
            </div>
            <span className="health-summary">
              <span className={`status-dot status-dot--${automationHealthy ? "live" : "paused"}`} />
              {automationHealthy ? "Healthy" : "Degraded"}
            </span>
          </div>
          <div className="automation-list">
            {automation.map((item) => {
              const live = item.status === "operational";
              return (
                <div className="automation-row" key={item.key}>
                  <span className={`automation-row__icon automation-row__icon--${live ? "live" : "paused"}`}>
                    {live ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <b>{live ? "Active" : item.status}</b>
                </div>
              );
            })}
          </div>
          <div className="demo-callout">
            <Bot size={18} />
            <p><strong>Safe demo mode</strong> uses deterministic mock enrichment and never contacts external services.</p>
          </div>
        </article>

        <article className="panel activity-panel">
          <div className="panel__header">
            <div>
              <p className="panel-kicker">Audit trail</p>
              <h2>Recent activity</h2>
            </div>
          </div>
          <div className="activity-list">
            {(dashboard?.activityFeed ?? []).slice(0, 4).map((event) => {
              const visual = activityVisual(event.kind);
              const Icon = visual.icon;
              const body = (
                <>
                  <span className={`activity-item__icon activity-item__icon--${visual.tone}`}>
                    <Icon size={16} />
                  </span>
                  <span>
                    <strong>{event.message}</strong>
                    <small>{event.companyName ?? "Workspace"}</small>
                  </span>
                  <time>{relativeTime(event.occurredAt)}</time>
                </>
              );
              return event.leadId ? (
                <Link
                  className="activity-item"
                  href={`/leads/${event.leadId}`}
                  key={event.id}
                >
                  {body}
                </Link>
              ) : (
                <div className="activity-item" key={event.id}>
                  {body}
                </div>
              );
            })}
            {(!dashboard || dashboard.activityFeed.length === 0) && (
              <p className="muted-copy">
                No activity yet. Enrich a lead to see events here.
              </p>
            )}
          </div>
        </article>
      </section>

      <div className="dashboard-status-strip">
        <span><Zap size={14} /> {metrics.total} leads captured</span>
        <span><CheckCircle2 size={14} /> {metrics.review} awaiting approval</span>
        <span>
          <Clock3 size={14} />{" "}
          {automation.find((item) => item.key === "emailDelivery")?.status ===
          "operational"
            ? "Email delivery active"
            : "Email delivery in demo"}
        </span>
      </div>
    </div>
  );
}
