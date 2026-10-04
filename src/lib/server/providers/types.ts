import "server-only";

import type {
  CompanyIntelligence,
  CompanyProfile,
  ContactIdentity,
  CriterionKey,
  EvidenceItem,
  Lead,
} from "@/contracts";

export type ProviderMode = "demo" | "production";

export interface NormalizedLeadInput {
  contact: ContactIdentity;
  company: CompanyProfile;
}

export interface CompanyResearchResult {
  website: string;
  domain: string;
  /** Whether the demo/production fetcher could retrieve the page at all. */
  reachable: boolean;
  title: string;
  description: string;
  sourceUrl: string;
  excerpt: string;
  /** Pages that were actually fetched (production multi-page research). */
  pages?: Array<{ url: string; title: string }>;
  /** Technologies detected from page markup/scripts (best-effort). */
  detectedTechnologies?: string[];
  fetchedAt: string;
}

export interface DraftRequest {
  input: NormalizedLeadInput;
  intelligence: CompanyIntelligence;
  topPainPoint: string | null;
}

export interface GeneratedDraft {
  subject: string;
  body: string;
}

export interface ExtractedIntelligence {
  summary: string;
  industry: string;
  estimatedSize: string;
  businessModel: string;
  location: string;
  technologies: string[];
  painPoints: string[];
  evidence: EvidenceItem[];
  confidence: CompanyIntelligence["confidence"];
  /** Suggested per-criterion scores; backend clamps and sums these. */
  criterionSuggestions: Partial<Record<CriterionKey, number>>;
}

export interface CompanyResearchProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  research(input: NormalizedLeadInput): Promise<CompanyResearchResult>;
}

export interface LeadIntelligenceProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  extract(
    input: NormalizedLeadInput,
    research: CompanyResearchResult,
  ): Promise<ExtractedIntelligence>;
  draft(request: DraftRequest): Promise<GeneratedDraft>;
}

export interface SendEmailInput {
  leadId: string;
  to: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  providerMessageId: string;
  sentAt: string;
}

export interface EmailDeliveryProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  /** False in demo mode — approval never triggers an external send. */
  readonly enabled: boolean;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export interface CrmSyncResult {
  externalId: string;
  syncedAt: string;
}

export interface CrmProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  readonly enabled: boolean;
  upsertLead(lead: Lead): Promise<CrmSyncResult>;
}

export interface ProviderRegistry {
  mode: ProviderMode;
  research: CompanyResearchProvider;
  intelligence: LeadIntelligenceProvider;
  email: EmailDeliveryProvider;
  crm: CrmProvider;
}
