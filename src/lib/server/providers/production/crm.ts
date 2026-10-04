import "server-only";

import type { Lead } from "@/contracts";
import { ProviderFailureError } from "@/lib/server/domain/errors";

import type { CrmProvider, CrmSyncResult } from "../types";

const TIMEOUT_MS = 12_000;

interface CrmResponse {
  id?: string;
}

/**
 * Production CRM adapter that POSTs a compact lead snapshot to a configurable
 * webhook (e.g. a Make.com scenario). Selected only when `CRM_WEBHOOK_URL` is
 * set and production mode is on.
 */
export class WebhookCrmProvider implements CrmProvider {
  readonly name = "webhook-crm";
  readonly mode = "production" as const;
  readonly enabled = true;

  constructor(private readonly webhookUrl: string) {}

  async upsertLead(lead: Lead): Promise<CrmSyncResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(this.webhookUrl, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          fullName: lead.contact.fullName,
          workEmail: lead.contact.workEmail,
          company: lead.company.name,
          domain: lead.company.domain,
          score: lead.qualification.score,
          tier: lead.qualification.tier,
          status: lead.status,
          draftSubject: lead.draft.subject,
          updatedAt: lead.updatedAt,
        }),
      });
    } catch (error) {
      throw new ProviderFailureError(
        error instanceof Error && error.name === "AbortError"
          ? "CRM sync timed out"
          : "CRM provider is unreachable",
        "CRM_FAILED",
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new ProviderFailureError(
        `CRM sync failed with status ${response.status}`,
        "CRM_FAILED",
      );
    }

    const payload = (await response.json().catch(() => null)) as
      | CrmResponse
      | null;

    return {
      externalId: payload?.id ?? lead.id,
      syncedAt: new Date().toISOString(),
    };
  }
}
