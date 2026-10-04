import "server-only";

import { ProviderUnavailableError } from "@/lib/server/domain/errors";

import type {
  EmailDeliveryProvider,
  SendEmailResult,
} from "../types";

/**
 * Demo delivery provider. Deliberately disabled: approval in demo mode never
 * sends a real email. Production adapters must be selected via env config.
 */
export class DemoEmailDeliveryProvider implements EmailDeliveryProvider {
  readonly name = "demo-email-delivery";
  readonly mode = "demo" as const;
  readonly enabled = false;

  async send(): Promise<SendEmailResult> {
    throw new ProviderUnavailableError(
      "Email delivery is disabled in demo mode",
      "DELIVERY_UNAVAILABLE",
    );
  }
}
