import {
  jsonOk,
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { enforceRateLimit } from "@/lib/server/cache/rate-limit";
import { rejectLead } from "@/lib/server/services/enrichment-service";

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
      await enforceRateLimit(request, "reject", 60, 60);
      const { id } = await context.params;
      const result = await rejectLead(id);
      return jsonOk(result.lead, { alreadyRejected: result.alreadyRejected });
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
