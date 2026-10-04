import { webhookLeadSchema } from "@/contracts";

import {
  jsonOk,
  readHeader,
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { enforceRateLimit } from "@/lib/server/cache/rate-limit";
import { AuthenticationError, ValidationError } from "@/lib/server/domain/errors";
import { verifySignature } from "@/lib/server/domain/signature";
import { getResolvedWebhookSecrets } from "@/lib/server/services/settings-service";
import { ingestWebhookLead } from "@/lib/server/services/lead-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseRawJson(raw: string): unknown {
  if (!raw.trim()) {
    throw new ValidationError("Request body must be valid JSON", {
      _root: ["Request body must be valid JSON"],
    });
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("Request body must be valid JSON", {
      _root: ["Request body must be valid JSON"],
    });
  }
}

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      await enforceRateLimit(request, "webhook:leads", 120, 60);
      const raw = await request.text();

      // Production webhooks are signed; enable the secret in Settings.
      const { inboundSignatureEnabled, inboundSecret } =
        await getResolvedWebhookSecrets();
      if (inboundSignatureEnabled && inboundSecret) {
        const signature = request.headers.get("X-SignalDesk-Signature");
        if (!verifySignature(raw, signature, inboundSecret)) {
          throw new AuthenticationError();
        }
      }

      const payload = webhookLeadSchema.parse(parseRawJson(raw));
      const idempotencyKey = readHeader(request, "Idempotency-Key");

      const companyWebsite =
        payload.companyWebsite ?? payload.website ?? payload.companyDomain ?? "";

      const result = await ingestWebhookLead(
        {
          fullName: payload.fullName,
          workEmail: payload.workEmail,
          companyWebsite,
          companyName: payload.companyName,
          role: payload.role,
          source: payload.source ?? "webhook",
        },
        idempotencyKey,
      );

      return jsonOk(
        result.lead,
        { duplicate: result.duplicate, idempotencyKey },
        result.duplicate ? 200 : 202,
      );
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
