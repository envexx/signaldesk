import type { HealthData } from "@/contracts";

import {
  jsonOk,
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { isoNow } from "@/lib/server/domain/time";
import { isDatabaseConfigured } from "@/lib/server/db/client";
import { isInngestConfigured } from "@/lib/server/inngest/client";
import { isRedisConfigured } from "@/lib/server/cache/kv";
import {
  assessProviderHealth,
  describeProviders,
  getProviderRegistry,
} from "@/lib/server/providers";
import { getResolvedEmailConfig } from "@/lib/server/services/settings-service";
import { countLeads } from "@/lib/server/services/lead-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      const registry = getProviderRegistry();
      const health = assessProviderHealth();
      const email = await getResolvedEmailConfig();

      const providers = describeProviders(registry).map((provider) =>
        provider.name.includes("email-delivery")
          ? {
              name: email.enabled
                ? "resend-email-delivery"
                : "demo-email-delivery",
              mode: email.enabled ? ("production" as const) : ("demo" as const),
              enabled: email.enabled,
              credentialsPresent: Boolean(email.apiKey),
            }
          : provider,
      );

      const data: HealthData = {
        status: health.status,
        mode: registry.mode,
        timestamp: isoNow(),
        uptimeMs: Math.round(process.uptime() * 1000),
        leadCount: await countLeads(),
        providers,
        infrastructure: {
          database: isDatabaseConfigured(),
          redis: isRedisConfigured(),
          inngest: isInngestConfigured(),
        },
        ...(health.missing.length > 0
          ? { missingConfiguration: health.missing }
          : {}),
      };

      return jsonOk(data);
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
