import "server-only";

import { ProviderFailureError } from "@/lib/server/domain/errors";

import type {
  EmailDeliveryProvider,
  SendEmailInput,
  SendEmailResult,
} from "../types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 15_000;

interface ResendResponse {
  id?: string;
  message?: string;
}

/**
 * Production delivery adapter backed by Resend. Never selected in demo mode,
 * so approval cannot trigger an external send without explicit configuration.
 */
export class ResendEmailDeliveryProvider implements EmailDeliveryProvider {
  readonly name = "resend-email-delivery";
  readonly mode = "production" as const;
  readonly enabled = true;

  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string = "",
    private readonly replyTo: string = "",
  ) {}

  private from(): string {
    return this.fromName
      ? `${this.fromName} <${this.fromEmail}>`
      : this.fromEmail;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: this.from(),
          to: [input.to],
          subject: input.subject,
          text: input.body,
          ...(this.replyTo ? { reply_to: this.replyTo } : {}),
          tags: [{ name: "leadId", value: input.leadId }],
        }),
      });
    } catch (error) {
      throw new ProviderFailureError(
        error instanceof Error && error.name === "AbortError"
          ? "Email delivery timed out"
          : "Email delivery provider is unreachable",
        "DELIVERY_FAILED",
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      const detail = errorBody?.message ?? errorBody?.error ?? "";
      throw new ProviderFailureError(
        `Email delivery failed (${response.status})${detail ? `: ${detail}` : ""}`,
        "DELIVERY_FAILED",
      );
    }

    const payload = (await response.json().catch(() => null)) as
      | ResendResponse
      | null;
    if (!payload?.id) {
      throw new ProviderFailureError(
        "Email delivery provider returned no message id",
        "DELIVERY_INVALID",
      );
    }

    return {
      providerMessageId: payload.id,
      sentAt: new Date().toISOString(),
    };
  }
}
