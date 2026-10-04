import type { LeadListMeta } from "@/contracts";
import { createLeadSchema, leadListQuerySchema } from "@/contracts";

import {
  jsonOk,
  readJsonBody,
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { enforceRateLimit } from "@/lib/server/cache/rate-limit";
import { createLead, listLeads } from "@/lib/server/services/lead-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      await enforceRateLimit(request, "leads:list", 120, 60);
      const url = new URL(request.url);
      const query = leadListQuerySchema.parse(
        Object.fromEntries(url.searchParams.entries()),
      );

      const result = await listLeads(query);
      const meta: LeadListMeta = {
        total: result.total,
        count: result.items.length,
        limit: result.limit,
        offset: result.offset,
        filters: {
          q: query.q ?? null,
          tier: query.tier ?? null,
          status: query.status ?? null,
        },
      };

      return jsonOk(result.items, meta);
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      await enforceRateLimit(request, "leads:create", 30, 60);
      const payload = createLeadSchema.parse(await readJsonBody(request));
      const lead = await createLead(payload, { source: payload.source });
      return jsonOk(lead, { created: true }, 201);
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
