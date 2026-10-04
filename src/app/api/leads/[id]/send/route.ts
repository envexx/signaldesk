import { sendLeadSchema } from "@/contracts";

import {
  jsonOk,
  readJsonBody,
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { enforceRateLimit } from "@/lib/server/cache/rate-limit";
import { sendLead } from "@/lib/server/services/enrichment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      await enforceRateLimit(request, "send", 30, 60);
      const { id } = await context.params;
      sendLeadSchema.parse(await readJsonBody(request));
      const result = await sendLead(id);
      return jsonOk(result.lead, { delivery: result.delivery });
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
