import { jsonOk, toErrorResponse, withRequestContext } from "@/lib/server/domain/api-response";
import { enforceRateLimit } from "@/lib/server/cache/rate-limit";
import { listDeliveries } from "@/lib/server/services/outbox-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      await enforceRateLimit(request, "outbox:list", 120, 60);
      const url = new URL(request.url);
      const limit = Math.min(
        200,
        Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50),
      );
      const items = await listDeliveries(limit);
      return jsonOk(items, { count: items.length, limit });
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
