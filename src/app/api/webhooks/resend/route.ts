import { Webhook } from "svix";

import type { ActivityKind } from "@/contracts";

import {
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { AuthenticationError } from "@/lib/server/domain/errors";
import { newEventId } from "@/lib/server/domain/ids";
import { logger } from "@/lib/server/observability/logger";
import { getResolvedWebhookSecrets } from "@/lib/server/services/settings-service";
import { getLeadRepository } from "@/lib/server/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ResendEvent {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[];
    tags?: Array<{ name?: string; value?: string }> | Record<string, string>;
  };
}

function extractLeadId(data: ResendEvent["data"]): string | null {
  const tags = data?.tags;
  if (!tags) return null;
  if (Array.isArray(tags)) {
    return tags.find((tag) => tag.name === "leadId")?.value ?? null;
  }
  return tags.leadId ?? null;
}

const KIND_BY_TYPE: Record<string, ActivityKind> = {
  "email.delivered": "lead.sent",
  "email.bounced": "workflow.failed",
  "email.complained": "workflow.failed",
};

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      const raw = await request.text();
      const { resendSignatureEnabled, resendSecret } =
        await getResolvedWebhookSecrets();

      if (!resendSignatureEnabled || !resendSecret) {
        logger.warn("resend webhook ignored (signature not enabled in Settings)");
        return Response.json({ data: { ignored: true }, meta: {} });
      }

      let event: ResendEvent;
      try {
        const verifier = new Webhook(resendSecret);
        event = verifier.verify(raw, {
          "svix-id": request.headers.get("svix-id") ?? "",
          "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
          "svix-signature": request.headers.get("svix-signature") ?? "",
        }) as unknown as ResendEvent;
      } catch {
        throw new AuthenticationError("Invalid Resend webhook signature");
      }

      const type = event.type ?? "unknown";
      const leadId = extractLeadId(event.data);
      const kind = KIND_BY_TYPE[type];

      if (leadId && kind) {
        const repository = getLeadRepository();
        const lead = await repository.getById(leadId);
        if (lead) {
          await repository.addActivity({
            id: newEventId(),
            kind,
            message:
              type === "email.delivered"
                ? `Email delivered to ${lead.company.name}.`
                : `Email delivery issue for ${lead.company.name} (${type}).`,
            leadId: lead.id,
            companyName: lead.company.name,
            tier:
              lead.qualification.tier === "UNASSESSED"
                ? null
                : lead.qualification.tier,
            occurredAt: new Date().toISOString(),
          });
        }
      }

      logger.info("resend webhook processed", { provider: "resend", outcome: type });

      return Response.json({ data: { received: true, type }, meta: {} });
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
