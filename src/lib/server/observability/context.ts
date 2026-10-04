import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface RequestContext {
  requestId: string;
  leadId?: string;
  workflowRunId?: string;
  stepKey?: string;
  provider?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function newRequestId(): string {
  return `req_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Resolve the correlation id from an inbound header or create one. */
export function contextFromRequest(request: Request): RequestContext {
  const header =
    request.headers.get("x-request-id")?.trim() ||
    request.headers.get("x-correlation-id")?.trim();
  return { requestId: header && header.length > 0 ? header : newRequestId() };
}
