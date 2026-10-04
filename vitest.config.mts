import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Keep tests decoupled from Next's server/client boundary shim.
      "server-only": path.resolve(rootDir, "tests/mocks/server-only.ts"),
      "@": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    clearMocks: true,
    env: {
      // Never let tests touch a real database or external provider.
      APP_MODE: "demo",
      DATABASE_URL: "",
      DEEPSEEK_API_KEY: "",
      AI_GATEWAY_API_KEY: "",
      FIRECRAWL_API_KEY: "",
      RESEND_API_KEY: "",
      INNGEST_EVENT_KEY: "",
      INNGEST_SIGNING_KEY: "",
      INNGEST_DEV: "",
      INNGEST_BASE_URL: "",
      SENTRY_DSN: "",
    },
  },
});
