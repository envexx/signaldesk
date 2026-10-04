import "server-only";

import { ProviderUnavailableError } from "@/lib/server/domain/errors";

import type { CrmProvider, CrmSyncResult } from "../types";

/** Demo CRM provider: no external sync. Lead state stays in the demo store. */
export class DemoCrmProvider implements CrmProvider {
  readonly name = "demo-crm";
  readonly mode = "demo" as const;
  readonly enabled = false;

  async upsertLead(): Promise<CrmSyncResult> {
    throw new ProviderUnavailableError(
      "CRM sync is disabled in demo mode",
      "CRM_UNAVAILABLE",
    );
  }
}
