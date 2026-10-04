import "server-only";

import { Inngest } from "inngest";

/**
 * Shared Inngest client for durable production workflows. In demo mode the
 * client is unused and processing stays synchronous.
 */
export const inngest = new Inngest({ id: "signaldesk" });

export const ENRICH_LEAD_EVENT = "signaldesk/lead.enrich";

export function isInngestConfigured(): boolean {
  return Boolean(
    process.env.INNGEST_EVENT_KEY?.trim() ||
      process.env.INNGEST_DEV?.trim() ||
      process.env.INNGEST_BASE_URL?.trim(),
  );
}
