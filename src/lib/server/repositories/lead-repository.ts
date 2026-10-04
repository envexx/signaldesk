import "server-only";

import type { ActivityEvent, Lead, LeadStatus, Tier } from "@/contracts";

import type { DashboardAggregate } from "@/lib/server/domain/dashboard-aggregate";

export type { DashboardAggregate } from "@/lib/server/domain/dashboard-aggregate";

export interface LeadListFilter {
  q?: string;
  tier?: Tier;
  status?: LeadStatus;
}

/**
 * Persistence-agnostic repository contract. The demo adapter is in-memory; a
 * PostgreSQL adapter can replace it later without touching services or routes.
 */
export interface LeadRepository {
  list(filter: LeadListFilter): Promise<Lead[]>;
  all(): Promise<Lead[]>;
  count(): Promise<number>;
  getById(id: string): Promise<Lead | null>;
  getByEmail(email: string): Promise<Lead | null>;
  getByIdempotencyKey(key: string): Promise<Lead | null>;
  create(lead: Lead): Promise<Lead>;
  /** Atomic read-modify-write; returns the updated lead or null if missing. */
  update(id: string, updater: (lead: Lead) => Lead): Promise<Lead | null>;
  addActivity(event: ActivityEvent): Promise<void>;
  listActivity(limit: number): Promise<ActivityEvent[]>;
  /** Aggregate dashboard read model (counts, funnel, attention queue, feed). */
  aggregateDashboard(): Promise<DashboardAggregate>;
  /** Remove every lead, child row, and activity event (demo reset/seed). */
  clearAll(): Promise<void>;
}
