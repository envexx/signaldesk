import { updateLeadSchema } from "@/contracts";

import {
  jsonOk,
  readJsonBody,
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { enforceRateLimit } from "@/lib/server/cache/rate-limit";
import { getLeadById, updateLead } from "@/lib/server/services/lead-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      await enforceRateLimit(request, "leads:get", 240, 60);
      const { id } = await context.params;
      const lead = await getLeadById(id);
      return jsonOk(lead);
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      await enforceRateLimit(request, "leads:update", 60, 60);
      const { id } = await context.params;
      const payload = updateLeadSchema.parse(await readJsonBody(request));
      const lead = await updateLead(id, payload);
      return jsonOk(lead, { updated: true });
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
