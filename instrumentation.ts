/**
 * Next.js instrumentation hook. Initializes server-side error monitoring when
 * `SENTRY_DSN` is configured and validates production configuration at startup.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { initSentry } = await import("@/lib/server/observability/sentry");
  await initSentry();

  const { assessProviderHealth } = await import("@/lib/server/providers");
  const { logger } = await import("@/lib/server/observability/logger");

  const health = assessProviderHealth();
  if (health.status === "degraded") {
    logger.error("production configuration incomplete", {
      outcome: "degraded",
      missing: health.missing.join(", "),
    });
    if (process.env.STRICT_STARTUP === "true") {
      throw new Error(
        `Missing required configuration: ${health.missing.join(", ")}`,
      );
    }
  }
}
