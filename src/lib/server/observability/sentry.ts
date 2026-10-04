import "server-only";

import type { RequestContext } from "./context";

let initialized = false;
let initFailed = false;

/**
 * Initialize Sentry lazily. `@sentry/node` is imported dynamically so demo mode
 * never loads it. Monitoring must never break application flow.
 */
export async function initSentry(): Promise<void> {
  if (initialized || initFailed) return;
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.APP_MODE === "production" ? "production" : "demo",
    });
    initialized = true;
  } catch {
    initFailed = true;
  }
}

export async function captureException(
  error: unknown,
  context?: Partial<RequestContext> & Record<string, unknown>,
): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/node");
    if (!initialized) {
      await initSentry();
    }
    Sentry.captureException(error, { extra: context });
    await Sentry.flush(2_000);
  } catch {
    // Never surface monitoring failures to the caller.
  }
}
