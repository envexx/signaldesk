import "server-only";

import type { ActivityEvent, Lead } from "@/contracts";

import { buildSeedData } from "@/data/seed-leads";
import { buildDashboardAggregate } from "@/lib/server/domain/dashboard-aggregate";

import type {
  DashboardAggregate,
  LeadListFilter,
  LeadRepository,
} from "./lead-repository";

interface DemoStore {
  leads: Map<string, Lead>;
  activity: ActivityEvent[];
}

const ACTIVITY_LIMIT = 200;

const globalForStore = globalThis as typeof globalThis & {
  __signaldeskDemoStore?: DemoStore;
  __signaldeskDemoStorePromise?: Promise<DemoStore>;
};

function clone(lead: Lead): Lead {
  return structuredClone(lead);
}

/** Lazily build the demo store once; seed construction is async. */
async function getStore(): Promise<DemoStore> {
  if (globalForStore.__signaldeskDemoStore) {
    return globalForStore.__signaldeskDemoStore;
  }
  if (!globalForStore.__signaldeskDemoStorePromise) {
    globalForStore.__signaldeskDemoStorePromise = buildSeedData().then(
      (seed) => {
        const store: DemoStore = {
          leads: new Map(seed.leads.map((lead) => [lead.id, lead])),
          activity: seed.activity.slice(0, ACTIVITY_LIMIT),
        };
        globalForStore.__signaldeskDemoStore = store;
        return store;
      },
    );
  }
  return globalForStore.__signaldeskDemoStorePromise;
}

function matchesFilter(lead: Lead, filter: LeadListFilter): boolean {
  if (filter.tier && lead.qualification.tier !== filter.tier) return false;
  if (filter.status && lead.status !== filter.status) return false;

  if (filter.q) {
    const needle = filter.q.trim().toLowerCase();
    if (needle.length > 0) {
      const haystack = [
        lead.contact.fullName,
        lead.contact.workEmail,
        lead.company.name,
        lead.company.domain,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
  }

  return true;
}

function timeOf(iso: string): number {
  return new Date(iso).getTime();
}

export class InMemoryLeadRepository implements LeadRepository {
  async list(filter: LeadListFilter = {}): Promise<Lead[]> {
    const store = await getStore();
    return [...store.leads.values()]
      .filter((lead) => matchesFilter(lead, filter))
      .sort((a, b) => timeOf(b.lastActivityAt) - timeOf(a.lastActivityAt))
      .map(clone);
  }

  async all(): Promise<Lead[]> {
    const store = await getStore();
    return [...store.leads.values()].map(clone);
  }

  async count(): Promise<number> {
    return (await getStore()).leads.size;
  }

  async getById(id: string): Promise<Lead | null> {
    const lead = (await getStore()).leads.get(id);
    return lead ? clone(lead) : null;
  }

  async getByEmail(email: string): Promise<Lead | null> {
    const normalized = email.trim().toLowerCase();
    const store = await getStore();
    for (const lead of store.leads.values()) {
      if (lead.contact.workEmail === normalized) return clone(lead);
    }
    return null;
  }

  async getByIdempotencyKey(key: string): Promise<Lead | null> {
    const store = await getStore();
    for (const lead of store.leads.values()) {
      if (lead.idempotencyKey === key) return clone(lead);
    }
    return null;
  }

  async create(lead: Lead): Promise<Lead> {
    const store = await getStore();
    store.leads.set(lead.id, clone(lead));
    return clone(lead);
  }

  async update(
    id: string,
    updater: (lead: Lead) => Lead,
  ): Promise<Lead | null> {
    const store = await getStore();
    const current = store.leads.get(id);
    if (!current) return null;
    const next = updater(clone(current));
    store.leads.set(id, clone(next));
    return clone(next);
  }

  async addActivity(event: ActivityEvent): Promise<void> {
    const store = await getStore();
    store.activity.unshift(event);
    if (store.activity.length > ACTIVITY_LIMIT) {
      store.activity.length = ACTIVITY_LIMIT;
    }
  }

  async listActivity(limit: number): Promise<ActivityEvent[]> {
    const store = await getStore();
    return store.activity
      .slice(0, Math.max(0, limit))
      .map((event) => ({ ...event }));
  }

  async aggregateDashboard(): Promise<DashboardAggregate> {
    const store = await getStore();
    return buildDashboardAggregate(
      [...store.leads.values()],
      store.activity,
    );
  }

  async clearAll(): Promise<void> {
    const store = await getStore();
    store.leads.clear();
    store.activity.length = 0;
  }
}

/** Process-wide singleton repository (survives Next.js HMR via globalThis). */
export const leadRepository: LeadRepository = new InMemoryLeadRepository();
