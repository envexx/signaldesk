import { describe, expect, it } from "vitest";

import { enforceRateLimit } from "@/lib/server/cache/rate-limit";
import { ProviderFailureError } from "@/lib/server/domain/errors";
import {
  DemoCrmProvider,
  DemoEmailDeliveryProvider,
  DemoLeadIntelligenceProvider,
} from "@/lib/server/providers/demo";
import type {
  CompanyResearchProvider,
  CompanyResearchResult,
  NormalizedLeadInput,
  ProviderRegistry,
} from "@/lib/server/providers/types";
import { runEnrichmentWorkflow } from "@/lib/server/workflows/enrichment-workflow";

import { makeLead } from "./helpers";

function requestFrom(ip: string): Request {
  return new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("rate limiting", () => {
  it("allows up to the limit then rejects with 429", async () => {
    const ip = `10.9.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;

    await expect(
      enforceRateLimit(requestFrom(ip), "unit-bucket", 3, 60),
    ).resolves.toBeUndefined();
    await expect(
      enforceRateLimit(requestFrom(ip), "unit-bucket", 3, 60),
    ).resolves.toBeUndefined();
    await expect(
      enforceRateLimit(requestFrom(ip), "unit-bucket", 3, 60),
    ).resolves.toBeUndefined();
    await expect(
      enforceRateLimit(requestFrom(ip), "unit-bucket", 3, 60),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });
});

class FlakyResearchProvider implements CompanyResearchProvider {
  readonly name = "flaky-research";
  readonly mode = "production" as const;

  constructor(private shouldFail: () => boolean) {}

  async research(input: NormalizedLeadInput): Promise<CompanyResearchResult> {
    if (this.shouldFail()) {
      throw new ProviderFailureError("upstream unavailable", "RESEARCH_FAILED");
    }
    return {
      website: input.company.website,
      domain: input.company.domain,
      reachable: true,
      title: `${input.company.name} — platform`,
      description: `${input.company.name} summary`,
      sourceUrl: input.company.website,
      excerpt: "excerpt",
      fetchedAt: new Date().toISOString(),
    };
  }
}

describe("provider failure mapping and retry", () => {
  it("maps provider failures to FAILED with a stable code, then resumes on retry", async () => {
    let failing = true;
    const providers: ProviderRegistry = {
      mode: "production",
      research: new FlakyResearchProvider(() => failing),
      intelligence: new DemoLeadIntelligenceProvider(),
      email: new DemoEmailDeliveryProvider(),
      crm: new DemoCrmProvider(),
    };

    const first = await runEnrichmentWorkflow(makeLead(), providers);
    expect(first.lead.status).toBe("FAILED");
    expect(
      first.lead.workflow.steps.find((step) => step.key === "research")
        ?.errorCode,
    ).toBe("RESEARCH_FAILED");

    failing = false;
    const retry = await runEnrichmentWorkflow(first.lead, providers);
    expect(retry.lead.status).toBe("READY_FOR_REVIEW");
    expect(retry.executed[0]).toBe("research");
    expect(retry.executed).not.toContain("validate");
  });
});
