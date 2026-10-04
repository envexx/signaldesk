import { approveLeadSchema } from "@/contracts";

import {
  jsonOk,
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { enforceRateLimit } from "@/lib/server/cache/rate-limit";
import { approveLead } from "@/lib/server/services/enrichment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      await enforceRateLimit(request, "approve", 60, 60);
      const { id } = await context.params;
      const payload = approveLeadSchema.parse(await readOptionalJson(request));
      const result = await approveLead(id, payload);
      return jsonOk(result.lead, { alreadyApproved: result.alreadyApproved });
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
