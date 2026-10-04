import {
  jsonOk,
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { getDashboard } from "@/lib/server/services/lead-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      const data = await getDashboard();
      return jsonOk(data, { generatedAt: data.generatedAt });
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
