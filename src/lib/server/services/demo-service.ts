import "server-only";

import { buildSeedData } from "@/data/seed-leads";

import { getLeadRepository } from "@/lib/server/repositories";
import { getDeliveryRepository } from "@/lib/server/repositories/delivery-repository";

export interface SeedResult {
  leads: number;
  activity: number;
}

/**
 * Populate the workspace with a deterministic, fully-enriched sample set
 * (no external provider calls). Replaces any existing demo data.
 */
export async function seedDemoWorkspace(): Promise<SeedResult> {
  await resetWorkspace();

  const seed = await buildSeedData();
  const repository = getLeadRepository();

  for (const lead of seed.leads) {
    await repository.create(lead);
  }
  for (const event of seed.activity) {
    await repository.addActivity(event);
  }

  return { leads: seed.leads.length, activity: seed.activity.length };
}

export async function resetWorkspace(): Promise<void> {
  await getLeadRepository().clearAll();
  await getDeliveryRepository().clearAll();
}
