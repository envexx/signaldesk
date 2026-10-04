import "server-only";

import {
  DemoCompanyResearchProvider,
  DemoCrmProvider,
  DemoEmailDeliveryProvider,
  DemoLeadIntelligenceProvider,
} from "./demo";
import { readProviderConfig, type ProviderConfig } from "./config";
import { WebhookCrmProvider } from "./production/crm";
import { ResendEmailDeliveryProvider } from "./production/delivery";
import { HubSpotCrmProvider } from "./production/hubspot";
import { AiGatewayIntelligenceProvider } from "./production/intelligence";
import { FirecrawlCompanyResearchProvider } from "./production/research";
import type { ProviderRegistry } from "./types";

export type { ProviderRegistry, ProviderMode } from "./types";

function demoRegistry(): ProviderRegistry {
  return {
    mode: "demo",
    research: new DemoCompanyResearchProvider(),
    intelligence: new DemoLeadIntelligenceProvider(),
    email: new DemoEmailDeliveryProvider(),
    crm: new DemoCrmProvider(),
  };
}

/**
 * Resolve the provider registry. Demo mode is the default and always works
 * without credentials. In production mode each provider is selected
 * independently, so a missing credential only degrades that one provider
 * (e.g. demo research + DeepSeek intelligence + Postgres persistence).
 */
export function getProviderRegistry(): ProviderRegistry {
  const config = readProviderConfig();
  if (config.requestedMode !== "production") return demoRegistry();

  const aiReady = Boolean(config.deepseekApiKey || config.aiGatewayApiKey);

  return {
    mode: "production",
    research: config.firecrawlApiKey
      ? new FirecrawlCompanyResearchProvider(config.firecrawlApiKey)
      : new DemoCompanyResearchProvider(),
    intelligence: aiReady
      ? new AiGatewayIntelligenceProvider()
      : new DemoLeadIntelligenceProvider(),
    email: config.resendApiKey
      ? new ResendEmailDeliveryProvider(
          config.resendApiKey,
          config.resendFromEmail,
        )
      : new DemoEmailDeliveryProvider(),
    crm: config.hubspotAccessToken
      ? new HubSpotCrmProvider(config.hubspotAccessToken)
      : config.crmWebhookUrl
        ? new WebhookCrmProvider(config.crmWebhookUrl)
        : new DemoCrmProvider(),
  };
}

export interface ProviderDescription {
  name: string;
  mode: "demo" | "production";
  enabled: boolean;
  credentialsPresent: boolean;
}

export interface ProviderHealth {
  status: "ok" | "degraded";
  missing: string[];
}

/**
 * Production readiness check. Demo mode is always healthy; production is
 * `degraded` when a required credential is missing (surfaced by `/api/health`
 * and logged at startup).
 */
export function assessProviderHealth(
  config: ProviderConfig = readProviderConfig(),
): ProviderHealth {
  if (config.requestedMode !== "production") {
    return { status: "ok", missing: [] };
  }

  const missing: string[] = [];
  if (!process.env.DATABASE_URL?.trim()) missing.push("DATABASE_URL");
  if (!config.firecrawlApiKey) missing.push("FIRECRAWL_API_KEY");
  if (!config.deepseekApiKey && !config.aiGatewayApiKey) {
    missing.push("DEEPSEEK_API_KEY (or AI_GATEWAY_API_KEY)");
  }

  return { status: missing.length > 0 ? "degraded" : "ok", missing };
}

/** Non-secret provider status for the health endpoint. */
export function describeProviders(
  registry: ProviderRegistry,
  config: ProviderConfig = readProviderConfig(),
): ProviderDescription[] {
  return [
    {
      name: registry.research.name,
      mode: registry.research.mode,
      enabled: true,
      credentialsPresent: Boolean(config.firecrawlApiKey),
    },
    {
      name: registry.intelligence.name,
      mode: registry.intelligence.mode,
      enabled: true,
      credentialsPresent: Boolean(
        config.deepseekApiKey || config.aiGatewayApiKey,
      ),
    },
    {
      name: registry.email.name,
      mode: registry.email.mode,
      enabled: registry.email.enabled,
      credentialsPresent: Boolean(config.resendApiKey),
    },
    {
      name: registry.crm.name,
      mode: registry.crm.mode,
      enabled: registry.crm.enabled,
      credentialsPresent: Boolean(
        config.crmWebhookUrl || config.hubspotAccessToken,
      ),
    },
  ];
}
