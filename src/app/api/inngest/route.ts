import { serve } from "inngest/next";
import type { NextRequest } from "next/server";

import { toErrorResponse } from "@/lib/server/domain/api-response";
import { ProviderUnavailableError } from "@/lib/server/domain/errors";
import { inngest } from "@/lib/server/inngest/client";
import { enrichLeadFunction } from "@/lib/server/inngest/functions/enrich-lead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = serve({
  client: inngest,
  functions: [enrichLeadFunction],
});

function isConfigured(): boolean {
  return Boolean(
    process.env.INNGEST_EVENT_KEY?.trim() ||
      process.env.INNGEST_SIGNING_KEY?.trim() ||
      process.env.INNGEST_DEV?.trim() ||
      process.env.NODE_ENV === "development",
  );
}

function unavailable(): Response {
  return toErrorResponse(
    new ProviderUnavailableError(
      "Inngest is not configured. Set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY.",
      "INNGEST_NOT_CONFIGURED",
    ),
  );
}

export async function GET(request: NextRequest): Promise<Response> {
  return isConfigured() ? handler.GET(request, undefined) : unavailable();
}

export async function POST(request: NextRequest): Promise<Response> {
  return isConfigured() ? handler.POST(request, undefined) : unavailable();
}

export async function PUT(request: NextRequest): Promise<Response> {
  return isConfigured() ? handler.PUT(request, undefined) : unavailable();
}
