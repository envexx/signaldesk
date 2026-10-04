import "server-only";

import { isDatabaseConfigured } from "@/lib/server/db/client";

import { leadRepository as inMemoryLeadRepository } from "./in-memory-lead-repository";
import type { LeadRepository } from "./lead-repository";
import { createPostgresLeadRepository } from "./postgres-lead-repository";

let cached: LeadRepository | null = null;

/**
 * Select the persistence adapter: PostgreSQL when `DATABASE_URL` is configured,
 * otherwise the deterministic in-memory demo repository. Defaults to demo so the
 * application runs with zero credentials.
 */
export function getLeadRepository(): LeadRepository {
  if (cached) return cached;
  cached = isDatabaseConfigured()
    ? createPostgresLeadRepository()
    : inMemoryLeadRepository;
  return cached;
}

export type { LeadRepository, LeadListFilter, DashboardAggregate } from "./lead-repository";
