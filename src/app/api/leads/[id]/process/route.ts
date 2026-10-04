import { processLeadSchema } from "@/contracts";

import {
  jsonOk,
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { enforceRateLimit } from "@/lib/server/cache/rate-limit";
import {
  ENRICH_LEAD_EVENT,
  inngest,
  isInngestConfigured,
} from "@/lib/server/inngest/client";
import { logger } from "@/lib/server/observability/logger";
import { processLead, markLeadProcessing } from "@/lib/server/services/enrichment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow the synchronous fallback to finish within Vercel's function limit.
export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function readOptionalJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      await enforceRateLimit(request, "process", 60, 60);
      const { id } = await context.params;
      const payload = processLeadSchema.parse(await readOptionalJson(request));
      const force = payload?.force ?? false;

      // Production: dispatch to Inngest and respond quickly with a job id.
      if (isInngestConfigured()) {
        const lead = await markLeadProcessing(id);
        try {
          const sent = await inngest.send({
            name: ENRICH_LEAD_EVENT,
            data: { leadId: id, force },
          });
          return jsonOk(
            lead,
            { ran: true, completed: false, jobId: sent.ids?.[0] ?? null },
            202,
          );
        } catch {
          // Inngest unreachable (e.g. local dev server not running): fall back
          // to synchronous processing so the request still succeeds.
          logger.warn("inngest dispatch failed; using synchronous processing", {
            leadId: id,
            errorCode: "INNGEST_DISPATCH_FAILED",
          });
        }
      }

      // Demo: run the deterministic workflow synchronously.
      const result = await processLead(id, { force });
      return jsonOk(result.lead, {
        ran: result.ran,
        completed: true,
        executed: result.executed,
      });
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
