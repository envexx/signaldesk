import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration. `generate` only needs the schema; `migrate` uses
 * `DATABASE_URL`. Demo mode never runs migrations.
 */
export default defineConfig({
  schema: "./src/lib/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/signaldesk",
  },
  strict: true,
  verbose: true,
});
