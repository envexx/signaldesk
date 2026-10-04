import "server-only";

import { processLead } from "@/lib/server/services/enrichment-service";

import { inngest, ENRICH_LEAD_EVENT } from "../client";

interface EnrichEventData {
  leadId: string;
  force?: boolean;
}

/**
 * Durable enrichment function. Inngest provides retries, concurrency limits,
 * and observability; orchestration reuses the same service used in demo mode so
 * both modes share one implementation.
 */
export const enrichLeadFunction = inngest.createFunction(
  {
    id: "enrich-lead",
    // One active run per lead (dedupes concurrent process requests).
    concurrency: [{ key: "event.data.leadId", limit: 1 }],
    retries: 2,
    triggers: [{ event: ENRICH_LEAD_EVENT }],
  },
  async ({ event, step }) => {
    const { leadId, force } = event.data as EnrichEventData;

    return step.run("run-enrichment", async () => {
      const result = await processLead(leadId, { force: Boolean(force) });
      return {
        leadId,
        status: result.lead.status,
        executed: result.executed,
        ran: result.ran,
      };
    });
  },
);
