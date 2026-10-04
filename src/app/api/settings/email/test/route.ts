import { z } from "zod";

import {
  jsonOk,
  toErrorResponse,
  withRequestContext,
} from "@/lib/server/domain/api-response";
import { enforceRateLimit } from "@/lib/server/cache/rate-limit";
import { resolveEmailDeliveryProvider } from "@/lib/server/services/email-service";
import { getResolvedEmailConfig } from "@/lib/server/services/settings-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const testSchema = z
  .object({ to: z.string().trim().max(255).optional() })
  .optional();

async function readOptionalJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async () => {
    try {
      await enforceRateLimit(request, "settings:email-test", 10, 60);
      const payload = testSchema.parse(await readOptionalJson(request));
      const config = await getResolvedEmailConfig();
      const provider = await resolveEmailDeliveryProvider();
      const to = payload?.to?.trim() || config.replyTo || config.fromEmail;

      if (!provider.enabled) {
        return jsonOk({
          mode: "demo",
          sent: false,
          to,
          message:
            "Resend is not enabled. Set the provider to Resend and add an API key.",
        });
      }

      const result = await provider.send({
        leadId: "email-test",
        to,
        subject: "SignalDesk email delivery test",
        body: "This is a test email from your SignalDesk workspace confirming that Resend delivery is configured correctly.",
      });

      return jsonOk({
        mode: "resend",
        sent: true,
        to,
        messageId: result.providerMessageId,
      });
    } catch (error) {
      return toErrorResponse(error);
    }
  });
}
