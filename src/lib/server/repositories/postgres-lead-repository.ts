import "server-only";

import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";

import type {
  ActivityEvent,
  CompanyIntelligence,
  CompanyProfile,
  ConfidenceLevel,
  ContactIdentity,
  CriterionKey,
  DraftStatus,
  EvidenceItem,
  Lead,
  LeadStatus,
  OutreachDraft,
  Qualification,
  RiskFlag,
  ScoreCriterion,
  Tier,
  WorkflowState,
  WorkflowStep,
  WorkflowStepKey,
} from "@/contracts";
import { WORKFLOW_STEP_KEYS, WORKFLOW_STEP_LABELS } from "@/contracts";

import { getDb, type Database } from "@/lib/server/db/client";
import * as s from "@/lib/server/db/schema";
import { buildDashboardAggregate } from "@/lib/server/domain/dashboard-aggregate";
import { emptyDraft } from "@/lib/server/domain/lead-factory";
import {
  CRITERION_ORDER,
  SCORING_RUBRIC,
  unscoredQualification,
} from "@/lib/server/domain/scoring";

import type {
  DashboardAggregate,
  LeadListFilter,
  LeadRepository,
} from "./lead-repository";

type LeadRow = typeof s.leads.$inferSelect;
type EvidenceRow = typeof s.leadEvidence.$inferSelect;
type PainRow = typeof s.leadPainPoints.$inferSelect;
type TechRow = typeof s.leadTechnologies.$inferSelect;
type ScoreRow = typeof s.leadScores.$inferSelect;
type RiskRow = typeof s.leadRiskFlags.$inferSelect;
type DraftRow = typeof s.outreachDrafts.$inferSelect;
type StepRow = typeof s.workflowSteps.$inferSelect;

interface Children {
  evidence: EvidenceRow[];
  pain: PainRow[];
  tech: TechRow[];
  scores: ScoreRow[];
  risks: RiskRow[];
  draft: DraftRow | null;
  steps: StepRow[];
}

function emptyChildren(): Children {
  return {
    evidence: [],
    pain: [],
    tech: [],
    scores: [],
    risks: [],
    draft: null,
    steps: [],
  };
}

function stepOrder(key: string): number {
  const index = WORKFLOW_STEP_KEYS.indexOf(key as WorkflowStepKey);
  return index === -1 ? WORKFLOW_STEP_KEYS.length : index;
}

/** Postgres returns `YYYY-MM-DD HH:MM:SS+00`; normalize to ISO 8601. */
function iso(value: string | null): string | null {
  if (value === null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function criterionOrder(key: string): number {
  const index = CRITERION_ORDER.indexOf(key as CriterionKey);
  return index === -1 ? CRITERION_ORDER.length : index;
}

function toQualification(row: LeadRow, children: Children): Qualification {
  if (children.scores.length === 0) {
    const fallback = unscoredQualification();
    return {
      ...fallback,
      riskFlags: children.risks.map(
        (risk): RiskFlag => ({
          code: risk.code,
          label: risk.label,
          severity: risk.severity as RiskFlag["severity"],
        }),
      ),
    };
  }

  const criteria: ScoreCriterion[] = [...children.scores]
    .sort((a, b) => criterionOrder(a.criterionKey) - criterionOrder(b.criterionKey))
    .map((score) => ({
      key: score.criterionKey as CriterionKey,
      label:
        SCORING_RUBRIC[score.criterionKey as CriterionKey]?.label ??
        score.criterionKey,
      score: score.score,
      max: score.max,
      rationale: score.rationale,
    }));

  return {
    score: row.score,
    tier: row.tier as Tier,
    reasoning: row.qualificationReasoning,
    criteria,
    riskFlags: children.risks.map(
      (risk): RiskFlag => ({
        code: risk.code,
        label: risk.label,
        severity: risk.severity as RiskFlag["severity"],
      }),
    ),
    scoredAt: iso(row.scoredAt),
  };
}

function toWorkflow(row: LeadRow, children: Children): WorkflowState {
  const steps: WorkflowStep[] = [...children.steps]
    .sort((a, b) => stepOrder(a.stepKey) - stepOrder(b.stepKey))
    .map((step) => ({
      key: step.stepKey as WorkflowStepKey,
      name:
        WORKFLOW_STEP_LABELS[step.stepKey as WorkflowStepKey] ?? step.stepKey,
      status: step.status as WorkflowStep["status"],
      attempt: step.attempt,
      startedAt: iso(step.startedAt),
      completedAt: iso(step.completedAt),
      durationMs: step.durationMs,
      errorCode: step.errorCode,
      errorMessage: step.errorMessage,
    }));

  return {
    currentStage: row.workflowCurrentStage as WorkflowStepKey,
    steps,
    attempts: row.workflowAttempts,
    processingDurationMs: row.processingDurationMs,
  };
}

function toLead(row: LeadRow, children: Children): Lead {
  const contact: ContactIdentity = {
    fullName: row.fullName,
    workEmail: row.workEmail,
    role: row.role,
    source: row.source,
  };
  const company: CompanyProfile = {
    name: row.companyName,
    domain: row.domain,
    website: row.website,
    industry: row.industry,
    estimatedSize: row.estimatedSize,
    businessModel: row.businessModel,
    location: row.location,
  };
  const enrichment: CompanyIntelligence = {
    summary: row.summary,
    painPoints: [...children.pain]
      .sort((a, b) => a.position - b.position)
      .map((item) => item.content),
    technologies: [...children.tech].map((item) => item.name),
    evidence: [...children.evidence]
      .sort((a, b) => a.position - b.position)
      .map(
        (item): EvidenceItem => ({
          id: item.id,
          label: item.label,
          detail: item.detail,
          sourceUrl: item.sourceUrl,
          kind: item.kind as EvidenceItem["kind"],
          confidence: item.confidence as ConfidenceLevel,
        }),
      ),
    confidence: row.confidence as ConfidenceLevel,
  };
  const draft: OutreachDraft = children.draft
    ? {
        subject: children.draft.subject,
        body: children.draft.body,
        status: children.draft.status as DraftStatus,
        version: children.draft.version,
        lastEditedAt: iso(children.draft.updatedAt),
      }
    : emptyDraft();

  return {
    id: row.id,
    contact,
    company,
    qualification: toQualification(row, children),
    enrichment,
    draft,
    workflow: toWorkflow(row, children),
      status: row.status as LeadStatus,
      createdAt: iso(row.createdAt) ?? row.createdAt,
      updatedAt: iso(row.updatedAt) ?? row.updatedAt,
      lastActivityAt: iso(row.lastActivityAt) ?? row.lastActivityAt,
      idempotencyKey: row.idempotencyKey,
    };
  }

async function loadChildren(
  db: Database,
  leadIds: string[],
): Promise<Map<string, Children>> {
  const grouped = new Map<string, Children>();
  for (const id of leadIds) grouped.set(id, emptyChildren());

  if (leadIds.length === 0) return grouped;

  const [evidence, pain, tech, scores, risks, drafts, steps] = await Promise.all([
    db.select().from(s.leadEvidence).where(inArray(s.leadEvidence.leadId, leadIds)),
    db.select().from(s.leadPainPoints).where(inArray(s.leadPainPoints.leadId, leadIds)),
    db.select().from(s.leadTechnologies).where(inArray(s.leadTechnologies.leadId, leadIds)),
    db.select().from(s.leadScores).where(inArray(s.leadScores.leadId, leadIds)),
    db.select().from(s.leadRiskFlags).where(inArray(s.leadRiskFlags.leadId, leadIds)),
    db.select().from(s.outreachDrafts).where(inArray(s.outreachDrafts.leadId, leadIds)),
    db
      .select({ step: s.workflowSteps, leadId: s.workflowRuns.leadId })
      .from(s.workflowSteps)
      .innerJoin(s.workflowRuns, eq(s.workflowSteps.workflowRunId, s.workflowRuns.id))
      .where(inArray(s.workflowRuns.leadId, leadIds)),
  ]);

  for (const item of evidence) grouped.get(item.leadId)?.evidence.push(item);
  for (const item of pain) grouped.get(item.leadId)?.pain.push(item);
  for (const item of tech) grouped.get(item.leadId)?.tech.push(item);
  for (const item of scores) grouped.get(item.leadId)?.scores.push(item);
  for (const item of risks) grouped.get(item.leadId)?.risks.push(item);
  for (const item of drafts) {
    const bucket = grouped.get(item.leadId);
    if (bucket) bucket.draft = item;
  }
  for (const item of steps) grouped.get(item.leadId)?.steps.push(item.step);

  return grouped;
}

async function hydrate(db: Database, rows: LeadRow[]): Promise<Lead[]> {
  const children = await loadChildren(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toLead(row, children.get(row.id) ?? emptyChildren()));
}

function leadValues(lead: Lead) {
  return {
    id: lead.id,
    fullName: lead.contact.fullName,
    workEmail: lead.contact.workEmail,
    role: lead.contact.role,
    source: lead.contact.source,
    companyName: lead.company.name,
    domain: lead.company.domain,
    website: lead.company.website,
    industry: lead.company.industry,
    estimatedSize: lead.company.estimatedSize,
    businessModel: lead.company.businessModel,
    location: lead.company.location,
    status: lead.status,
    tier: lead.qualification.tier,
    score: lead.qualification.score,
    qualificationReasoning: lead.qualification.reasoning,
    scoredAt: lead.qualification.scoredAt,
    summary: lead.enrichment.summary,
    confidence: lead.enrichment.confidence,
    workflowCurrentStage: lead.workflow.currentStage,
    workflowAttempts: lead.workflow.attempts,
    processingDurationMs: lead.workflow.processingDurationMs,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    lastActivityAt: lead.lastActivityAt,
    idempotencyKey: lead.idempotencyKey,
  };
}

/** Write or replace a full lead graph inside a transaction. */
async function writeLead(tx: Database, lead: Lead): Promise<void> {
  await tx
    .insert(s.leads)
    .values(leadValues(lead))
    .onConflictDoUpdate({
      target: s.leads.id,
      set: leadValues(lead),
    });

  await tx.delete(s.leadEvidence).where(eq(s.leadEvidence.leadId, lead.id));
  await tx.delete(s.leadPainPoints).where(eq(s.leadPainPoints.leadId, lead.id));
  await tx.delete(s.leadTechnologies).where(eq(s.leadTechnologies.leadId, lead.id));
  await tx.delete(s.leadScores).where(eq(s.leadScores.leadId, lead.id));
  await tx.delete(s.leadRiskFlags).where(eq(s.leadRiskFlags.leadId, lead.id));

  const now = lead.updatedAt;

  if (lead.enrichment.evidence.length > 0) {
    await tx
      .insert(s.leadEvidence)
      .values(
        lead.enrichment.evidence.map((item, index) => ({
          // Namespaced by lead id so two leads on the same domain never collide.
          id: `ev_${lead.id}_${index}`,
          leadId: lead.id,
          position: index,
          label: item.label,
          detail: item.detail,
          sourceUrl: item.sourceUrl,
          kind: item.kind,
          confidence: item.confidence,
          createdAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: s.leadEvidence.id,
        set: {
          position: sql`excluded.position`,
          label: sql`excluded.label`,
          detail: sql`excluded.detail`,
          sourceUrl: sql`excluded.source_url`,
          kind: sql`excluded.kind`,
          confidence: sql`excluded.confidence`,
          createdAt: sql`excluded.created_at`,
        },
      });
  }

  if (lead.enrichment.painPoints.length > 0) {
    await tx
      .insert(s.leadPainPoints)
      .values(
        lead.enrichment.painPoints.map((content, index) => ({
          id: `pain_${lead.id}_${index}`,
          leadId: lead.id,
          content,
          position: index,
        })),
      )
      .onConflictDoUpdate({
        target: s.leadPainPoints.id,
        set: { content: sql`excluded.content`, position: sql`excluded.position` },
      });
  }

  if (lead.enrichment.technologies.length > 0) {
    await tx
      .insert(s.leadTechnologies)
      .values(
        lead.enrichment.technologies.map((name, index) => ({
          id: `tech_${lead.id}_${index}`,
          leadId: lead.id,
          name,
          sourceEvidenceId: null,
        })),
      )
      .onConflictDoUpdate({
        target: s.leadTechnologies.id,
        set: { name: sql`excluded.name` },
      });
  }

  if (lead.qualification.criteria.length > 0) {
    await tx
      .insert(s.leadScores)
      .values(
        lead.qualification.criteria.map((criterion) => ({
          id: `score_${lead.id}_${criterion.key}`,
          leadId: lead.id,
          criterionKey: criterion.key,
          score: criterion.score,
          max: criterion.max,
          rationale: criterion.rationale,
          scoredAt: lead.qualification.scoredAt,
          modelVersion: null,
          rubricVersion: "icp-v1",
        })),
      )
      .onConflictDoUpdate({
        target: s.leadScores.id,
        set: {
          score: sql`excluded.score`,
          max: sql`excluded.max`,
          rationale: sql`excluded.rationale`,
          scoredAt: sql`excluded.scored_at`,
          rubricVersion: sql`excluded.rubric_version`,
        },
      });
  }

  if (lead.qualification.riskFlags.length > 0) {
    await tx
      .insert(s.leadRiskFlags)
      .values(
        lead.qualification.riskFlags.map((flag) => ({
          id: `risk_${lead.id}_${flag.code}`,
          leadId: lead.id,
          code: flag.code,
          label: flag.label,
          severity: flag.severity,
          resolvedAt: null,
        })),
      )
      .onConflictDoUpdate({
        target: s.leadRiskFlags.id,
        set: {
          label: sql`excluded.label`,
          severity: sql`excluded.severity`,
        },
      });
  }

  await tx
    .insert(s.outreachDrafts)
    .values({
      id: `draft_${lead.id}`,
      leadId: lead.id,
      subject: lead.draft.subject,
      body: lead.draft.body,
      status: lead.draft.status,
      version: lead.draft.version,
      approvedBy: null,
      approvedAt:
        lead.draft.status === "APPROVED" || lead.draft.status === "SENT"
          ? lead.draft.lastEditedAt
          : null,
      createdAt: lead.createdAt,
      updatedAt: lead.draft.lastEditedAt ?? now,
    })
    .onConflictDoUpdate({
      target: s.outreachDrafts.leadId,
      set: {
        subject: lead.draft.subject,
        body: lead.draft.body,
        status: lead.draft.status,
        version: lead.draft.version,
        approvedAt:
          lead.draft.status === "APPROVED" || lead.draft.status === "SENT"
            ? lead.draft.lastEditedAt
            : null,
        updatedAt: lead.draft.lastEditedAt ?? now,
      },
    });

  const runId = `wf_${lead.id}`;
  await tx
    .insert(s.workflowRuns)
    .values({
      id: runId,
      leadId: lead.id,
      providerRunId: null,
      status: lead.status,
      attempt: lead.workflow.attempts,
      startedAt: lead.workflow.steps[0]?.startedAt ?? lead.createdAt,
      completedAt:
        lead.status === "READY_FOR_REVIEW" ||
        lead.status === "APPROVED" ||
        lead.status === "SENT" ||
        lead.status === "FAILED"
          ? lead.lastActivityAt
          : null,
      durationMs: lead.workflow.processingDurationMs,
    })
    .onConflictDoUpdate({
      target: s.workflowRuns.id,
      set: {
        status: lead.status,
        attempt: lead.workflow.attempts,
        completedAt:
          lead.status === "READY_FOR_REVIEW" ||
          lead.status === "APPROVED" ||
          lead.status === "SENT" ||
          lead.status === "FAILED"
            ? lead.lastActivityAt
            : null,
        durationMs: lead.workflow.processingDurationMs,
      },
    });

  await tx.delete(s.workflowSteps).where(eq(s.workflowSteps.workflowRunId, runId));
  if (lead.workflow.steps.length > 0) {
    await tx
      .insert(s.workflowSteps)
      .values(
        lead.workflow.steps.map((step) => ({
          id: `wfstep_${lead.id}_${step.key}`,
          workflowRunId: runId,
          stepKey: step.key,
          status: step.status,
          attempt: step.attempt,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          durationMs: step.durationMs,
          errorCode: step.errorCode,
          errorMessage: step.errorMessage,
        })),
      )
      .onConflictDoUpdate({
        target: s.workflowSteps.id,
        set: {
          status: sql`excluded.status`,
          attempt: sql`excluded.attempt`,
          startedAt: sql`excluded.started_at`,
          completedAt: sql`excluded.completed_at`,
          durationMs: sql`excluded.duration_ms`,
          errorCode: sql`excluded.error_code`,
          errorMessage: sql`excluded.error_message`,
        },
      });
  }
}

export class PostgresLeadRepository implements LeadRepository {
  constructor(private readonly db: Database) {}

  async list(filter: LeadListFilter): Promise<Lead[]> {
    const conditions = [];
    if (filter.tier) conditions.push(eq(s.leads.tier, filter.tier));
    if (filter.status) conditions.push(eq(s.leads.status, filter.status));
    if (filter.q && filter.q.trim()) {
      const needle = `%${filter.q.trim()}%`;
      conditions.push(
        or(
          ilike(s.leads.fullName, needle),
          ilike(s.leads.companyName, needle),
          ilike(s.leads.workEmail, needle),
          ilike(s.leads.domain, needle),
        ),
      );
    }

    const rows = await this.db
      .select()
      .from(s.leads)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(s.leads.lastActivityAt));

    return hydrate(this.db, rows);
  }

  async all(): Promise<Lead[]> {
    const rows = await this.db.select().from(s.leads);
    return hydrate(this.db, rows);
  }

  async count(): Promise<number> {
    const rows = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(s.leads);
    return rows[0]?.value ?? 0;
  }

  async getById(id: string): Promise<Lead | null> {
    const rows = await this.db
      .select()
      .from(s.leads)
      .where(eq(s.leads.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    const [lead] = await hydrate(this.db, rows);
    return lead ?? null;
  }

  async getByEmail(email: string): Promise<Lead | null> {
    const rows = await this.db
      .select()
      .from(s.leads)
      .where(eq(s.leads.workEmail, email.trim().toLowerCase()))
      .limit(1);
    if (rows.length === 0) return null;
    const [lead] = await hydrate(this.db, rows);
    return lead ?? null;
  }

  async getByIdempotencyKey(key: string): Promise<Lead | null> {
    const rows = await this.db
      .select()
      .from(s.leads)
      .where(eq(s.leads.idempotencyKey, key))
      .limit(1);
    if (rows.length === 0) return null;
    const [lead] = await hydrate(this.db, rows);
    return lead ?? null;
  }

  async create(lead: Lead): Promise<Lead> {
    await this.db.transaction(async (tx) => {
      await writeLead(tx as unknown as Database, lead);
    });
    return lead;
  }

  async update(
    id: string,
    updater: (lead: Lead) => Lead,
  ): Promise<Lead | null> {
    const current = await this.getById(id);
    if (!current) return null;
    const next = updater(current);
    await this.db.transaction(async (tx) => {
      await writeLead(tx as unknown as Database, next);
    });
    return next;
  }

  async addActivity(event: ActivityEvent): Promise<void> {
    await this.db.insert(s.activityEvents).values({
      id: event.id,
      leadId: event.leadId,
      kind: event.kind,
      message: event.message,
      metadataJson: {
        companyName: event.companyName,
        tier: event.tier,
      },
      occurredAt: event.occurredAt,
    });
  }

  async listActivity(limit: number): Promise<ActivityEvent[]> {
    const rows = await this.db
      .select()
      .from(s.activityEvents)
      .orderBy(desc(s.activityEvents.occurredAt))
      .limit(Math.max(0, limit));

    return rows.map((row) => {
      const meta = (row.metadataJson ?? {}) as {
        companyName?: string | null;
        tier?: ActivityEvent["tier"];
      };
      return {
        id: row.id,
        kind: row.kind as ActivityEvent["kind"],
        message: row.message,
        leadId: row.leadId,
        companyName: meta.companyName ?? null,
        tier: meta.tier ?? null,
        occurredAt: iso(row.occurredAt) ?? row.occurredAt,
      };
    });
  }

  async aggregateDashboard(): Promise<DashboardAggregate> {
    const [leads, activity] = await Promise.all([
      this.all(),
      this.listActivity(8),
    ]);
    return buildDashboardAggregate(leads, activity);
  }

  async clearAll(): Promise<void> {
    // activity_events has no FK, so clear it first; leads cascade to children.
    await this.db.delete(s.activityEvents);
    await this.db.delete(s.leads);
  }
}

export function createPostgresLeadRepository(): LeadRepository {
  const db = getDb();
  if (!db) {
    throw new Error("DATABASE_URL is not configured");
  }
  return new PostgresLeadRepository(db);
}
