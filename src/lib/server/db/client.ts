import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let database: Database | null = null;

/**
 * Lazily create a pooled Postgres/Drizzle client. Returns null in demo mode
 * (no `DATABASE_URL`), so no connection is attempted without configuration.
 */
export function getDb(): Database | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  if (!pool) {
    pool = new Pool({ connectionString: url, max: 5 });
    database = drizzle(pool, { schema });
  }
  return database;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export { schema };
