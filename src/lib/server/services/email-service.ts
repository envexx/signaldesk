import "server-only";

import { DemoEmailDeliveryProvider } from "@/lib/server/providers/demo";
import { ResendEmailDeliveryProvider } from "@/lib/server/providers/production/delivery";
import type { EmailDeliveryProvider } from "@/lib/server/providers/types";

import { getResolvedEmailConfig } from "./settings-service";

/**
 * Resolve the email provider from workspace Settings (with env fallback).
 * Demo mode is used unless Resend is enabled with an API key.
 */
export async function resolveEmailDeliveryProvider(): Promise<EmailDeliveryProvider> {
  const config = await getResolvedEmailConfig();
  if (config.provider === "resend" && config.apiKey && config.enabled) {
    return new ResendEmailDeliveryProvider(
      config.apiKey,
      config.fromEmail,
      config.fromName,
      config.replyTo,
    );
  }
  return new DemoEmailDeliveryProvider();
}
