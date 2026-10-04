import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import type { ApiErrorBody } from "@/contracts";

import {
  contextFromRequest,
  getRequestContext,
  runWithContext,
} from "@/lib/server/observability/context";
import { logger } from "@/lib/server/observability/logger";
import { captureException } from "@/lib/server/observability/sentry";

import { AppError } from "./errors";

/** Run a route handler inside a request context so logs share a correlation id. */
export function withRequestContext<T>(
  request: Request,
  handler: () => Promise<T>,
): Promise<T> {
  return Promise.resolve(runWithContext(contextFromRequest(request), handler));
}

export function jsonOk<T>(
  data: T,
  meta: object = {},
  status = 200,
): NextResponse {
  return NextResponse.json({ data, meta }, { status });
}

export function jsonError(body: ApiErrorBody, status: number): NextResponse {
  return NextResponse.json({ error: body }, { status });
}

export function fieldsFromZod(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "_root";
    (fields[path] ??= []).push(issue.message);
  }
  return fields;
}

/**
 * Convert any thrown value into a safe API error response. Internal errors log
 * only the error name/message — never request payloads, PII, or env values.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return jsonError(
      {
        code: "VALIDATION_ERROR",
        message: "The request payload is invalid",
        fields: fieldsFromZod(error),
      },
      400,
    );
  }

  if (error instanceof AppError) {
    return jsonError(
      {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      },
      error.status,
    );
  }

  const label = error instanceof Error ? error.name : "UnknownError";
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? `: ${error.cause.message}`
      : "";
  logger.error("unhandled api error", {
    errorCode: "INTERNAL_ERROR",
    requestId: getRequestContext()?.requestId,
    outcome: label,
    reason:
      (error instanceof Error ? error.message : "unknown error").slice(0, 300) +
      cause.slice(0, 300),
  });
  void captureException(error, {
    requestId: getRequestContext()?.requestId,
    leadId: getRequestContext()?.leadId,
  });

  return jsonError(
    {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again.",
    },
    500,
  );
}

/** Read a JSON body, converting malformed payloads into a validation error. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(
      "VALIDATION_ERROR",
      "Request body must be valid JSON",
      400,
      { _root: ["Request body must be valid JSON"] },
    );
  }
}

/** Header lookup that trims and treats empty strings as absent. */
export function readHeader(request: Request, name: string): string | null {
  const value = request.headers.get(name)?.trim();
  return value && value.length > 0 ? value : null;
}
