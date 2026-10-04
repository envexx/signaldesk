import { settingsSchema } from "@/contracts";

import {
  jsonOk,
  readJsonBody,
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { enforceRateLimit } from "@/lib/server/cache/rate-limit";
import { getSettings, updateSettings } from "@/lib/server/services/settings-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      await enforceRateLimit(request, "settings:get", 120, 60);
      return jsonOk(await getSettings());
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}

export async function PUT(request: Request): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      await enforceRateLimit(request, "settings:update", 30, 60);
      const payload = settingsSchema.parse(await readJsonBody(request));
      const settings = await updateSettings(payload);
      return jsonOk(settings, { updated: true });
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
