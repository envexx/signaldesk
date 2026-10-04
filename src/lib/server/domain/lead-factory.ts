import "server-only";

import type {
  CompanyIntelligence,
  CompanyProfile,
  ContactIdentity,
  Lead,
  OutreachDraft,
} from "@/contracts";

import { unscoredQualification } from "./scoring";
import { isoNow } from "./time";
import { createInitialWorkflow } from "./workflow";

export function emptyEnrichment(): CompanyIntelligence {
  return {
    summary: null,
    painPoints: [],
    technologies: [],
    evidence: [],
    confidence: "low",
  };
}

export function emptyDraft(): OutreachDraft {
  return {
    subject: "",
    body: "",
    status: "DRAFT",
    version: 0,
    lastEditedAt: null,
  };
}

export interface NewLeadRecordInput {
  id: string;
  contact: ContactIdentity;
  company: CompanyProfile;
  createdAt?: string;
  idempotencyKey?: string | null;
}

/** Build a fresh, unscored lead with a captured workflow. */
export function createLeadRecord(input: NewLeadRecordInput): Lead {
  const createdAt = input.createdAt ?? isoNow();
  return {
    id: input.id,
    contact: input.contact,
    company: input.company,
    qualification: unscoredQualification(),
    enrichment: emptyEnrichment(),
    draft: emptyDraft(),
    workflow: createInitialWorkflow(createdAt),
    status: "CAPTURED",
    createdAt,
    updatedAt: createdAt,
    lastActivityAt: createdAt,
    idempotencyKey: input.idempotencyKey ?? null,
  };
}
