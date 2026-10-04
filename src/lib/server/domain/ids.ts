import "server-only";

import { randomUUID } from "node:crypto";

import { slugify } from "@/contracts";

/** Monotonic-ish unique id with a readable prefix. */
export function newId(prefix: string): string {
  const stamp = Date.now().toString(36);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
  return `${prefix}_${stamp}${suffix}`;
}

export function newLeadId(): string {
  return newId("lead");
}

export function newEventId(): string {
  return newId("evt");
}

/** Deterministic id for seeded records, e.g. `lead_northwind-logistics`. */
export function seedLeadId(domain: string): string {
  return `lead_${slugify(domain)}`;
}

export function seedEventId(domain: string, suffix: string): string {
  return `evt_${slugify(domain)}-${slugify(suffix, 20)}`;
}
