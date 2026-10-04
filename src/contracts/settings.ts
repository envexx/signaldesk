/**
 * Workspace settings shared by frontend and backend.
 *
 * - `targetProspect` = ICP / target prospecting data (who is a good fit).
 * - `companyContext` = the sender's own context docs (reference for drafting).
 * - `email`          = delivery configuration (Resend or demo).
 * - `webhooks`       = signing secrets for inbound + delivery webhooks.
 *
 * Secrets are write-only: the API never returns their values, only `has*`
 * booleans. Resolution falls back to environment variables when unset.
 */

export interface TargetProspectProfile {
  industries: string[];
  companySizes: string[];
  regions: string[];
  roles: string[];
  painPoints: string[];
  buyingSignals: string[];
  disqualifiers: string[];
  notes: string;
}

export interface CompanyContext {
  companyName: string;
  website: string;
  valueProposition: string;
  offerings: string[];
  differentiators: string[];
  caseStudies: string[];
  tone: string;
  callToAction: string;
  signature: string;
  notes: string;
}

export type EmailProvider = "demo" | "resend";

export interface EmailSettingsView {
  provider: EmailProvider;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  enabled: boolean;
  /** True when a Resend API key is stored (value itself is never returned). */
  hasApiKey: boolean;
}

export interface EmailSettingsInput {
  provider: EmailProvider;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  enabled: boolean;
  /** Write-only. Omit to keep the stored key; send "" to clear it. */
  apiKey?: string;
}

export interface WebhookSettingsView {
  inboundSignatureEnabled: boolean;
  resendSignatureEnabled: boolean;
  hasInboundSecret: boolean;
  hasResendSecret: boolean;
}

export interface WebhookSettingsInput {
  inboundSignatureEnabled: boolean;
  resendSignatureEnabled: boolean;
  /** Write-only. Omit to keep; send "" to clear. */
  inboundSecret?: string;
  /** Write-only. Omit to keep; send "" to clear. */
  resendSecret?: string;
}

export interface WorkspaceSettings {
  targetProspect: TargetProspectProfile;
  companyContext: CompanyContext;
  email: EmailSettingsView;
  webhooks: WebhookSettingsView;
  updatedAt: string | null;
}

/** Payload accepted by `PUT /api/settings`. */
export interface UpdateSettingsInput {
  targetProspect: TargetProspectProfile;
  companyContext: CompanyContext;
  email: EmailSettingsInput;
  webhooks: WebhookSettingsInput;
}
