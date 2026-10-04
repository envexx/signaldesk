"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  CircleDot,
  Clock3,
  Code2,
  Copy,
  Cable,
  ExternalLink,
  FileSearch,
  Globe2,
  Lightbulb,
  Mail,
  MapPin,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Target,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useApiStore } from "@/components/providers/api-store";
import { PageLoading } from "@/components/ui/page-loading";
import { ScoreRing } from "@/components/ui/score-ring";
import { ConfidencePill, StatusPill, TierPill } from "@/components/ui/status-pill";
import { WorkflowTimeline } from "@/components/workflow/workflow-timeline";
import type { Lead } from "@/lib/demo/types";

const criterionConfig = [
  { key: "companyFit" as const, label: "Company fit", max: 35 },
  { key: "problemFit" as const, label: "Problem fit", max: 30 },
  { key: "buyingSignal" as const, label: "Buying signal", max: 20 },
  { key: "dataConfidence" as const, label: "Data confidence", max: 15 },
];

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function DraftWorkspace({ lead }: { lead: Lead }) {
  const { saveDraft, approveLead, sendLead, rejectLead, processLead } =
    useApiStore();
  const [subject, setSubject] = useState(lead.draft.subject);
  const [body, setBody] = useState(lead.draft.body);
  const [saved, setSaved] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const updateSubject = (value: string) => {
    setSubject(value);
    setSaved(false);
    setNotice(null);
  };

  const updateBody = (value: string) => {
    setBody(value);
    setSaved(false);
    setNotice(null);
  };

  const handleSave = async () => {
    await saveDraft(lead.id, subject, body);
    setSaved(true);
    setNotice("Draft saved.");
  };

  const handleRewrite = async () => {
    const firstName = lead.fullName.split(" ")[0];
    const nextSubject = `One workflow idea for ${lead.company.name}`;
    const nextBody = `Hi ${firstName},\n\nThanks for your interest. I took a closer look at ${lead.company.name} and one opportunity stood out: making the move from a new inbound signal to an informed sales response both faster and more consistent.\n\nSignalDesk prepares the company context, fit reasoning, and a source-aware draft for your team—then pauses for human approval.\n\nWould you be open to a 15-minute workflow review next week?\n\nBest,\nNadia`;
    setSubject(nextSubject);
    setBody(nextBody);
    await saveDraft(lead.id, nextSubject, nextBody);
    setSaved(true);
    setNotice("A shorter variation is ready.");
  };

  const handleApprove = async () => {
    await approveLead(lead.id, { subject, body });
    setSaved(true);
    setConfirming(false);
    setNotice("Draft approved. Use “Send email” to deliver it.");
  };

  const handleReject = async () => {
    await rejectLead(lead.id);
    setConfirming(false);
    setNotice("Draft rejected and returned for review.");
  };

  const handleSend = async () => {
    await sendLead(lead.id);
    setNotice("Message sent. Check the Outbox for delivery status.");
  };

  const handleRerun = async () => {
    await processLead(lead.id, true);
    setNotice("Re-ran research and regenerated the draft.");
  };

  return (
    <article className="panel draft-workspace">
      <div className="panel__header draft-workspace__header">
        <div>
          <p className="panel-kicker">Human-in-the-loop</p>
          <h2>Nurture draft</h2>
        </div>
        <div className="draft-status">
          <span className={`save-state ${saved ? "save-state--saved" : ""}`}>
            {saved ? <Check size={13} /> : <CircleDot size={13} />}
            {saved ? "Saved" : "Unsaved changes"}
          </span>
          <span className={`pill pill--draft-${lead.draft.status.toLowerCase()}`}>
            {lead.draft.status.toLowerCase()}
          </span>
        </div>
      </div>

      {notice && (
        <div className="inline-notice" role="status">
          <CheckCircle2 size={16} /> {notice}
          <button type="button" aria-label="Dismiss notice" onClick={() => setNotice(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {confirming && (
        <div className="approval-confirmation">
          <span><ShieldCheck size={19} /></span>
          <div>
            <strong>Approve this draft?</strong>
            <p>Approval locks the draft. Nothing is sent until you use “Send email”.</p>
          </div>
          <button className="button button--ghost button--compact" type="button" onClick={() => setConfirming(false)}>
            Cancel
          </button>
          <button className="button button--primary button--compact" type="button" onClick={() => void handleApprove()}>
            <Check size={15} /> Confirm approval
          </button>
        </div>
      )}

      <div className="draft-grid">
        <div className="draft-editor">
          <div className="field-group">
            <label htmlFor="draft-subject">Subject line</label>
            <input
              id="draft-subject"
              value={subject}
              onChange={(event) => updateSubject(event.target.value)}
              placeholder="Draft subject line"
            />
          </div>
          <div className="field-group draft-body-field">
            <div className="field-label-row">
              <label htmlFor="draft-body">Email body</label>
              <span>{body.length} characters</span>
            </div>
            <textarea
              id="draft-body"
              value={body}
              onChange={(event) => updateBody(event.target.value)}
              placeholder="No draft available yet."
              rows={16}
            />
          </div>
          <div className="draft-editor__actions">
            <button className="button button--secondary button--compact" type="button" onClick={() => void handleRewrite()}>
              <RefreshCw size={15} /> Rewrite
            </button>
            <button className="button button--secondary button--compact" type="button" onClick={() => void handleRerun()}>
              <RefreshCw size={15} /> Re-run research
            </button>
            <button className="button button--secondary button--compact" type="button" onClick={() => void handleSave()} disabled={saved}>
              <Save size={15} /> Save draft
            </button>
            <button
              className="button button--primary button--compact"
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!subject.trim() || !body.trim() || lead.draft.status === "APPROVED" || lead.draft.status === "SENT"}
            >
              <Check size={15} /> {lead.draft.status === "APPROVED" ? "Approved" : "Approve draft"}
            </button>
            {lead.status === "APPROVED" && (
              <button
                className="button button--primary button--compact"
                type="button"
                onClick={() => void handleSend()}
              >
                <Send size={15} /> Send email
              </button>
            )}
          </div>
          <button className="reject-link" type="button" onClick={() => void handleReject()}>
            Reject this draft
          </button>
        </div>

        <div className="email-preview-wrap">
          <div className="email-preview-label">
            <span>Recipient preview</span>
            <span><span className="status-dot status-dot--paused" /> Not sent</span>
          </div>
          <div className="email-preview">
            <div className="email-preview__chrome">
              <span /> <span /> <span />
            </div>
            <div className="email-preview__meta">
              <span className="avatar avatar--email">NP</span>
              <div>
                <strong>Nadia from SignalDesk</strong>
                <small>to {lead.fullName} &lt;{lead.workEmail}&gt;</small>
              </div>
            </div>
            <h3>{subject || "Your subject line will appear here"}</h3>
            <div className="email-preview__body">
              {body ? body.split("\n").map((line, index) => (
                line ? <p key={index}>{line}</p> : <br key={index} />
              )) : <p>Your approved message preview will appear here.</p>}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function EnrichmentProgress({
  lead,
  onStart,
  onRefresh,
}: {
  lead: Lead;
  onStart: () => void;
  onRefresh: () => void;
}) {
  useEffect(() => {
    const timer = window.setInterval(onRefresh, 2_500);
    return () => window.clearInterval(timer);
  }, [onRefresh]);

  const done = lead.workflow.filter(
    (step) => step.status === "SUCCEEDED",
  ).length;
  const total = lead.workflow.length;

  return (
    <div className="workbench-page">
      <div className="workbench-breadcrumb">
        <Link className="back-link" href="/leads">
          <ArrowLeft size={15} /> Lead pipeline
        </Link>
        <span>/</span>
        <span>{lead.company.name}</span>
      </div>

      <section className="lead-hero">
        <div className="lead-hero__identity">
          <span className="avatar avatar--hero">{lead.initials}</span>
          <div>
            <div className="lead-hero__eyebrow">
              <StatusPill status={lead.status} />
              <span>Started {formatDateTime(lead.updatedAt)}</span>
            </div>
            <h1>{lead.fullName}</h1>
            <p>
              {lead.role} at <strong>{lead.company.name}</strong>
            </p>
          </div>
        </div>
      </section>

      <article
        className="panel enrichment-progress"
        role="status"
        aria-live="polite"
      >
        <div className="enrichment-progress__header">
          <span className="spinner" aria-hidden="true" />
          <div>
            <p className="panel-kicker">Enrichment</p>
            <h2>Researching {lead.company.name}…</h2>
            <p>
              Resolving the website, extracting company intelligence, scoring
              ICP fit, and drafting a follow-up. This page refreshes
              automatically.
            </p>
          </div>
          <span className="enrichment-progress__count">
            {done}/{total} steps
          </span>
        </div>
        <div className="enrichment-progress__bar" aria-hidden="true">
          <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        {lead.status === "CAPTURED" && (
          <button
            className="button button--primary"
            type="button"
            onClick={onStart}
          >
            <ArrowRight size={16} /> Start enrichment
          </button>
        )}
      </article>

      <article className="panel workflow-card">
        <div className="panel__header">
          <div>
            <p className="panel-kicker">Operational audit trail</p>
            <h2>Workflow timeline</h2>
          </div>
        </div>
        <WorkflowTimeline steps={lead.workflow} />
      </article>
    </div>
  );
}

export function LeadWorkbench({ leadId }: { leadId: string }) {
  const { leads, hydrated, processLead, refresh } = useApiStore();
  const [copied, setCopied] = useState(false);
  const lead = leads.find((item) => item.id === leadId);

  if (!hydrated) return <PageLoading />;

  if (!lead) {
    return (
      <section className="empty-state empty-state--page">
        <span className="empty-state__icon"><FileSearch size={26} /></span>
        <h1>Lead not found</h1>
        <p>This demo lead may have been removed when local data was reset.</p>
        <Link className="button button--primary" href="/leads">
          <ArrowLeft size={16} /> Return to pipeline
        </Link>
      </section>
    );
  }

  if (lead.status === "CAPTURED" || lead.status === "PROCESSING") {
    return (
      <EnrichmentProgress
        lead={lead}
        onStart={() => void processLead(lead.id)}
        onRefresh={() => void refresh()}
      />
    );
  }

  const copyEmail = async () => {
    await navigator.clipboard.writeText(lead.workEmail);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };

  return (
    <div className="workbench-page">
      <div className="workbench-breadcrumb">
        <Link className="back-link" href="/leads"><ArrowLeft size={15} /> Lead pipeline</Link>
        <span>/</span>
        <span>{lead.company.name}</span>
      </div>

      <section className="lead-hero">
        <div className="lead-hero__identity">
          <span className="avatar avatar--hero">{lead.initials}</span>
          <div>
            <div className="lead-hero__eyebrow">
              <StatusPill status={lead.status} />
              <span>Updated {formatDateTime(lead.updatedAt)}</span>
            </div>
            <h1>{lead.fullName}</h1>
            <p>{lead.role} at <strong>{lead.company.name}</strong></p>
            <div className="lead-hero__contact">
              <a href={`mailto:${lead.workEmail}`}><Mail size={14} /> {lead.workEmail}</a>
              <button type="button" onClick={copyEmail} aria-label="Copy lead email">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <a href={lead.company.website} target="_blank" rel="noreferrer"><Globe2 size={14} /> {lead.company.domain}</a>
            </div>
          </div>
        </div>
        <div className="lead-hero__score">
          <ScoreRing score={lead.qualification.score} size="large" />
          <div>
            <small>ICP qualification</small>
            <TierPill tier={lead.qualification.tier} />
          </div>
        </div>
        {lead.status === "FAILED" ? (
          <button className="button button--primary" type="button" onClick={() => void processLead(lead.id)}>
            <RotateCcw size={16} /> Retry enrichment
          </button>
        ) : (
          <a className="button button--secondary" href="#draft-workspace">
            Review draft <ArrowRight size={16} />
          </a>
        )}
      </section>

      {lead.qualification.riskFlags.length > 0 && (
        <section className="risk-banner">
          <span><AlertTriangle size={18} /></span>
          <div>
            <strong>{lead.qualification.riskFlags.length} item{lead.qualification.riskFlags.length > 1 ? "s" : ""} need attention</strong>
            <p>{lead.qualification.riskFlags.join(" · ")}</p>
          </div>
        </section>
      )}

      <section className="workbench-grid workbench-grid--overview">
        <article className="panel intelligence-card">
          <div className="panel__header">
            <div>
              <p className="panel-kicker">Evidence-backed profile</p>
              <h2>Company intelligence</h2>
            </div>
            <ConfidencePill value={lead.enrichment.confidence} />
          </div>
          <p className="company-summary">{lead.company.summary}</p>
          <div className="fact-grid">
            <div><span><Building2 size={15} /> Industry</span><strong>{lead.company.industry}</strong></div>
            <div><span><Users size={15} /> Company size</span><strong>{lead.company.estimatedSize}</strong></div>
            <div><span><Target size={15} /> Business model</span><strong>{lead.company.businessModel}</strong></div>
            <div><span><MapPin size={15} /> Location</span><strong>{lead.company.location}</strong></div>
          </div>
          <div className="technology-list">
            <span className="subsection-label"><Code2 size={15} /> Detected technologies</span>
            <div>
              {lead.company.technologies.length ? lead.company.technologies.map((technology) => (
                <span className="tech-chip" key={technology}>{technology}</span>
              )) : <span className="muted-copy">No technologies verified yet.</span>}
            </div>
          </div>
        </article>

        <article className="panel score-card">
          <div className="panel__header">
            <div>
              <p className="panel-kicker">Explainable scoring</p>
              <h2>Why this score</h2>
            </div>
            <span className="score-total">{lead.qualification.score}<small>/100</small></span>
          </div>
          <p className="score-reasoning">{lead.qualification.reasoning}</p>
          <div className="criteria-list">
            {criterionConfig.map((criterion) => {
              const score = lead.qualification.criteria[criterion.key];
              return (
                <div className="criterion" key={criterion.key}>
                  <div><span>{criterion.label}</span><strong>{score}/{criterion.max}</strong></div>
                  <div className="criterion__bar"><span style={{ width: `${Math.max(0, (score / criterion.max) * 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="workbench-grid workbench-grid--evidence">
        <article className="panel pain-card">
          <div className="panel__header">
            <div>
              <p className="panel-kicker">Context hypothesis</p>
              <h2>Likely pain points</h2>
            </div>
            <Lightbulb size={20} />
          </div>
          {lead.enrichment.painPoints.length ? (
            <ul className="pain-list">
              {lead.enrichment.painPoints.map((painPoint, index) => (
                <li key={painPoint}><span>0{index + 1}</span><p>{painPoint}</p></li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">Pain points will appear after a successful enrichment.</p>
          )}
        </article>

        <article className="panel evidence-card">
          <div className="panel__header">
            <div>
              <p className="panel-kicker">Trust layer</p>
              <h2>Evidence & sources</h2>
            </div>
            <FileSearch size={20} />
          </div>
          <div className="evidence-list">
            {lead.enrichment.evidence.map((evidence) => (
              <div className="evidence-item" key={evidence.id}>
                <span className={`evidence-item__type evidence-item__type--${evidence.sourceType.toLowerCase()}`}>
                  {evidence.sourceType === "WEBSITE" ? <Globe2 size={14} /> : evidence.sourceType === "FORM_INPUT" ? <PencilLine size={14} /> : <Bot size={14} />}
                </span>
                <div>
                  <strong>{evidence.label}</strong>
                  <span>
                    {evidence.sourceType === "AI_INFERENCE" ? "AI inference" : evidence.sourceType === "FORM_INPUT" ? "Form input" : "Company website"}
                    <ConfidencePill value={evidence.confidence} />
                  </span>
                </div>
                {evidence.url && (
                  <a href={evidence.url} target="_blank" rel="noreferrer" aria-label={`Open source: ${evidence.label}`}>
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section id="draft-workspace">
        <DraftWorkspace key={`${lead.id}-${lead.draft.lastEditedAt}-${lead.draft.status}`} lead={lead} />
      </section>

      <article className="panel workflow-card">
        <div className="panel__header">
          <div>
            <p className="panel-kicker">Operational audit trail</p>
            <h2>Workflow timeline</h2>
          </div>
          <div className="workflow-summary">
            <Clock3 size={15} />
            {lead.processingDurationMs ? `${(lead.processingDurationMs / 1000).toFixed(1)}s total` : "Paused"}
          </div>
        </div>
        <WorkflowTimeline steps={lead.workflow} />
      </article>

      <div className="frontend-mode-note">
        <Cable size={15} />
        This screen is powered by the SignalDesk backend API. Demo mode never sends a real email.
      </div>
    </div>
  );
}
