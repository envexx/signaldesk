import "server-only";

import type { Lead } from "@/contracts";
import { ProviderFailureError } from "@/lib/server/domain/errors";

import type { CrmProvider, CrmSyncResult } from "../types";

const BASE_URL = "https://api.hubapi.com";
const TIMEOUT_MS = 12_000;

interface HubSpotObject {
  id?: string;
}

interface HubSpotSearchResponse {
  results?: HubSpotObject[];
}

/**
 * Production CRM adapter backed by the HubSpot CRM v3 API. Upserts a contact by
 * email; company/score/tier remain available to HubSpot workflows via the
 * associated contact properties. Best-effort: failures surface as CRM_FAILED.
 */
export class HubSpotCrmProvider implements CrmProvider {
  readonly name = "hubspot-crm";
  readonly mode = "production" as const;
  readonly enabled = true;

  constructor(private readonly accessToken: string) {}

  private async call<T>(
    path: string,
    init: RequestInit,
    errorCode: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.accessToken}`,
          ...init.headers,
        },
      });
      if (!response.ok) {
        throw new ProviderFailureError(
          `HubSpot request failed with status ${response.status}`,
          errorCode,
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ProviderFailureError) throw error;
      throw new ProviderFailureError(
        error instanceof Error && error.name === "AbortError"
          ? "HubSpot request timed out"
          : "HubSpot is unreachable",
        errorCode,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async upsertLead(lead: Lead): Promise<CrmSyncResult> {
    const [firstname, ...rest] = lead.contact.fullName.split(/\s+/);
    const properties: Record<string, string> = {
      email: lead.contact.workEmail,
      firstname: firstname ?? "",
      lastname: rest.join(" "),
      company: lead.company.name,
      website: lead.company.website,
      jobtitle: lead.contact.role ?? "",
    };

    const search = await this.call<HubSpotSearchResponse>(
      "/crm/v3/objects/contacts/search",
      {
        method: "POST",
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "email",
                  operator: "EQ",
                  value: lead.contact.workEmail,
                },
              ],
            },
          ],
          properties: ["email"],
          limit: 1,
        }),
      },
      "CRM_FAILED",
    );

    const syncedAt = new Date().toISOString();
    const existing = search.results?.[0];

    if (existing?.id) {
      const updated = await this.call<HubSpotObject>(
        `/crm/v3/objects/contacts/${existing.id}`,
        { method: "PATCH", body: JSON.stringify({ properties }) },
        "CRM_FAILED",
      );
      return { externalId: updated.id ?? existing.id, syncedAt };
    }

    const created = await this.call<HubSpotObject>(
      "/crm/v3/objects/contacts",
      { method: "POST", body: JSON.stringify({ properties }) },
      "CRM_FAILED",
    );
    if (!created.id) {
      throw new ProviderFailureError(
        "HubSpot returned no contact id",
        "CRM_INVALID",
      );
    }
    return { externalId: created.id, syncedAt };
  }
}
