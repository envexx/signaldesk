import {
  jsonOk,
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { enforceRateLimit } from "@/lib/server/cache/rate-limit";
import { seedDemoWorkspace } from "@/lib/server/services/demo-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      await enforceRateLimit(request, "demo:seed", 10, 60);
      const result = await seedDemoWorkspace();
      return jsonOk(result, { seeded: true });
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
