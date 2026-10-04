import "server-only";

import type { ProviderMode } from "./types";

export interface ProviderConfig {
  /** `APP_MODE` from the environment; adapters still degrade to demo. */
  requestedMode: ProviderMode;
  firecrawlApiKey: string | null;
  aiGatewayApiKey: string | null;
  deepseekApiKey: string | null;
  aiModel: string | null;
  resendApiKey: string | null;
  resendFromEmail: string;
  hubspotAccessToken: string | null;
  crmWebhookUrl: string | null;
  webhookSigningSecret: string | null;
  resendWebhookSecret: string | null;
}

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export function readProviderConfig(): ProviderConfig {
  return {
    requestedMode: env("APP_MODE") === "production" ? "production" : "demo",
    firecrawlApiKey: env("FIRECRAWL_API_KEY"),
    aiGatewayApiKey: env("AI_GATEWAY_API_KEY"),
    deepseekApiKey: env("DEEPSEEK_API_KEY"),
    aiModel: env("AI_MODEL"),
    resendApiKey: env("RESEND_API_KEY"),
    resendFromEmail: env("RESEND_FROM_EMAIL") ?? "outreach@example.com",
    hubspotAccessToken: env("HUBSPOT_ACCESS_TOKEN"),
    crmWebhookUrl: env("CRM_WEBHOOK_URL"),
    webhookSigningSecret: env("WEBHOOK_SIGNING_SECRET"),
    resendWebhookSecret: env("RESEND_WEBHOOK_SECRET"),
  };
}
