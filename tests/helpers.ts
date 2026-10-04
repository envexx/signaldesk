import { createLeadRecord } from "@/lib/server/domain/lead-factory";
import { normalizeEmail, normalizeWebsite } from "@/contracts";
import type { Lead } from "@/contracts";

export interface MakeLeadOverrides {
  fullName?: string;
  workEmail?: string;
  website?: string;
  companyName?: string;
}

let counter = 0;

/** Build an in-memory lead without touching the shared repository. */
export function makeLead(overrides: MakeLeadOverrides = {}): Lead {
  const site = normalizeWebsite(overrides.website ?? "example-widgets.com");
  if (!site) throw new Error("Invalid test website");

  counter += 1;

  return createLeadRecord({
    id: `lead_test_${counter}_${Math.random().toString(36).slice(2, 8)}`,
    contact: {
      fullName: overrides.fullName ?? "Test Person",
      workEmail: normalizeEmail(
        overrides.workEmail ?? "test.person@example-widgets.com",
      ),
      role: "Head of Operations",
      source: "test",
    },
    company: {
      name: overrides.companyName ?? "Example Widgets",
      domain: site.domain,
      website: site.website,
      industry: null,
      estimatedSize: null,
      businessModel: null,
      location: null,
    },
  });
}
