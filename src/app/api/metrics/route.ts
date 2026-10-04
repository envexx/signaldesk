import {
  jsonOk,
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { snapshotMetrics } from "@/lib/server/observability/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      return jsonOk(snapshotMetrics());
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
