import "server-only";

import type {
  TargetProspectProfile,
  CompanyContext,
  EmailProvider,
  UpdateSettingsInput,
  WorkspaceSettings,
} from "@/contracts";

import { isoNow } from "@/lib/server/domain/time";
import {
  getSettingsRepository,
  type StoredSettings,
} from "@/lib/server/repositories/settings-repository";

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

const DEFAULT_TARGET_PROSPECT: TargetProspectProfile = {
  industries: [
    "B2B SaaS",
    "IT services & consulting",
    "Digital & marketing agencies",
    "Professional services",
    "Logistics & supply-chain tech",
    "Fintech",
  ],
  companySizes: ["11-50", "51-200", "201-500"],
  regions: ["Southeast Asia", "APAC", "Global (remote-friendly)"],
  roles: [
    "Founder / CEO",
    "Head of Growth",
    "VP Sales",
    "Marketing Lead",
    "RevOps / Sales Ops",
    "Operations Manager",
  ],
  painPoints: [
    "Manual lead research slows first response",
    "Inbound leads are qualified inconsistently",
    "Generic follow-ups miss company-specific context",
    "CRM data is incomplete or stale",
    "SDR time is spent on low-fit leads",
  ],
  buyingSignals: [
    "Hiring SDRs or growth roles",
    "Recently raised funding",
    "New website or rebrand",
    "Mentions of a CRM or sales-tooling change",
    "Active content marketing or webinars",
    "Expanding into new regions",
  ],
  disqualifiers: [
    "Personal/student email with no company domain",
    "No accessible website",
    "B2C-only business",
    "Direct competitor offering the same service",
    "Recruiter or spam enquiry",
  ],
  notes:
    "Prioritise teams with an inbound motion and roughly 2-20 people in growth/sales. Prefer signals found on the company website or job posts over assumptions.",
};

const DEFAULT_COMPANY_CONTEXT: CompanyContext = {
  companyName: "SignalDesk",
  website: "https://signaldesk.example",
  valueProposition:
    "SignalDesk turns an inbound form fill into an evidence-backed account brief and a ready-to-approve follow-up in under a minute, so growth teams respond faster and stop wasting time on low-fit leads.",
  offerings: [
    "Inbound lead enrichment from a company website",
    "Evidence-backed company intelligence",
    "Explainable ICP scoring",
    "AI-drafted, human-approved follow-up emails",
    "Workflow automation (CRM sync and delivery)",
  ],
  differentiators: [
    "Every insight is labelled as source or inference",
    "Scores come from a transparent rubric, not the model",
    "A human must approve before any email is sent",
    "Runs in a safe demo mode without external credentials",
  ],
  caseStudies: [
    "A logistics team cut first-response time from hours to minutes",
    "A SaaS growth team increased qualified-lead throughput without adding SDRs",
  ],
  tone: "Consultative, concise, specific. No hype, no buzzwords, no pressure.",
  callToAction: "a short 15-minute call to see whether this is relevant",
  signature: "The SignalDesk team",
  notes:
    "Reference the lead's own context (their inbound enquiry, company and likely pain point). If a fact is uncertain, do not state it. Keep the email under about 120 words.",
};

function defaultStoredSettings(): StoredSettings {
  const resendKey = env("RESEND_API_KEY");
  return {
    targetProspect: DEFAULT_TARGET_PROSPECT,
    companyContext: DEFAULT_COMPANY_CONTEXT,
    email: {
      provider: resendKey ? "resend" : "demo",
      fromEmail: env("RESEND_FROM_EMAIL") ?? "",
      fromName: "",
      replyTo: "",
      enabled: Boolean(resendKey),
      apiKey: null,
    },
    webhooks: {
      inboundSignatureEnabled: Boolean(env("WEBHOOK_SIGNING_SECRET")),
      resendSignatureEnabled: Boolean(env("RESEND_WEBHOOK_SECRET")),
      inboundSecret: null,
      resendSecret: null,
    },
    updatedAt: "",
  };
}

function applySecret(
  current: string | null,
  incoming: string | undefined,
): string | null {
  if (incoming === undefined) return current;
  const trimmed = incoming.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toView(stored: StoredSettings): WorkspaceSettings {
  const resolvedEmailKey = stored.email.apiKey ?? env("RESEND_API_KEY");
  const resolvedInbound = stored.webhooks.inboundSecret ?? env("WEBHOOK_SIGNING_SECRET");
  const resolvedResend = stored.webhooks.resendSecret ?? env("RESEND_WEBHOOK_SECRET");

  return {
    targetProspect: stored.targetProspect,
    companyContext: stored.companyContext,
    email: {
      provider: stored.email.provider as EmailProvider,
      fromEmail: stored.email.fromEmail,
      fromName: stored.email.fromName,
      replyTo: stored.email.replyTo,
      enabled: stored.email.enabled,
      hasApiKey: Boolean(resolvedEmailKey),
    },
    webhooks: {
      inboundSignatureEnabled: stored.webhooks.inboundSignatureEnabled,
      resendSignatureEnabled: stored.webhooks.resendSignatureEnabled,
      hasInboundSecret: Boolean(resolvedInbound),
      hasResendSecret: Boolean(resolvedResend),
    },
    updatedAt: stored.updatedAt || null,
  };
}

async function getStoredSettings(): Promise<StoredSettings> {
  const stored = await getSettingsRepository().get();
  if (!stored) return defaultStoredSettings();
  // Merge so a partial stored object still has every field.
  const base = defaultStoredSettings();
  return {
    targetProspect: stored.targetProspect ?? base.targetProspect,
    companyContext: stored.companyContext ?? base.companyContext,
    email: { ...base.email, ...stored.email },
    webhooks: { ...base.webhooks, ...stored.webhooks },
    updatedAt: stored.updatedAt || base.updatedAt,
  };
}

export const DEFAULT_SETTINGS: WorkspaceSettings = toView(defaultStoredSettings());

export async function getSettings(): Promise<WorkspaceSettings> {
  return toView(await getStoredSettings());
}

export async function updateSettings(
  input: UpdateSettingsInput,
): Promise<WorkspaceSettings> {
  const current = await getStoredSettings();

  const next: StoredSettings = {
    targetProspect: input.targetProspect,
    companyContext: input.companyContext,
    email: {
      provider: input.email.provider,
      fromEmail: input.email.fromEmail,
      fromName: input.email.fromName,
      replyTo: input.email.replyTo,
      enabled: input.email.enabled,
      apiKey: applySecret(current.email.apiKey, input.email.apiKey),
    },
    webhooks: {
      inboundSignatureEnabled: input.webhooks.inboundSignatureEnabled,
      resendSignatureEnabled: input.webhooks.resendSignatureEnabled,
      inboundSecret: applySecret(
        current.webhooks.inboundSecret,
        input.webhooks.inboundSecret,
      ),
      resendSecret: applySecret(
        current.webhooks.resendSecret,
        input.webhooks.resendSecret,
      ),
    },
    updatedAt: isoNow(),
  };

  await getSettingsRepository().save(next);
  return toView(next);
}

export interface ResolvedEmailConfig {
  provider: "demo" | "resend";
  apiKey: string | null;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  enabled: boolean;
}

/** Server-side email config: DB settings with environment fallback. */
export async function getResolvedEmailConfig(): Promise<ResolvedEmailConfig> {
  const stored = await getStoredSettings();
  const apiKey = stored.email.apiKey ?? env("RESEND_API_KEY");
  const provider =
    stored.email.provider === "resend" && apiKey ? "resend" : "demo";
  return {
    provider,
    apiKey,
    fromEmail:
      stored.email.fromEmail || env("RESEND_FROM_EMAIL") || "outreach@example.com",
    fromName: stored.email.fromName,
    replyTo: stored.email.replyTo,
    enabled: stored.email.enabled && provider === "resend",
  };
}

export interface ResolvedWebhookSecrets {
  inboundSignatureEnabled: boolean;
  resendSignatureEnabled: boolean;
  inboundSecret: string | null;
  resendSecret: string | null;
}

/** Server-side webhook secrets: DB settings with environment fallback. */
export async function getResolvedWebhookSecrets(): Promise<ResolvedWebhookSecrets> {
  const stored = await getStoredSettings();
  return {
    inboundSignatureEnabled: stored.webhooks.inboundSignatureEnabled,
    resendSignatureEnabled: stored.webhooks.resendSignatureEnabled,
    inboundSecret: stored.webhooks.inboundSecret ?? env("WEBHOOK_SIGNING_SECRET"),
    resendSecret: stored.webhooks.resendSecret ?? env("RESEND_WEBHOOK_SECRET"),
  };
}
