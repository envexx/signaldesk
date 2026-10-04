import { describe, expect, it } from "vitest";

import type { Lead } from "@/contracts";
import { getProviderRegistry } from "@/lib/server/providers";
import { runEnrichmentWorkflow } from "@/lib/server/workflows/enrichment-workflow";

import { makeLead } from "./helpers";

function withFailedResearch(lead: Lead): Lead {
  const at = lead.createdAt;
  return {
    ...lead,
    status: "FAILED",
    workflow: {
      ...lead.workflow,
      currentStage: "research",
      steps: lead.workflow.steps.map((step) => {
        if (step.key === "validate") {
          return {
            ...step,
            status: "SUCCEEDED" as const,
            attempt: 1,
            startedAt: at,
            completedAt: at,
            durationMs: 10,
          };
        }
        if (step.key === "research") {
          return {
            ...step,
            status: "FAILED" as const,
            attempt: 1,
            startedAt: at,
            completedAt: at,
            durationMs: 10,
            errorCode: "RESEARCH_FAILED",
            errorMessage: "Company website could not be retrieved",
          };
        }
        return step;
      }),
    },
  };
}

describe("runEnrichmentWorkflow", () => {
  it("processes a fresh lead to READY_FOR_REVIEW without external credentials", async () => {
    const providers = getProviderRegistry();
    const result = await runEnrichmentWorkflow(makeLead(), providers);

    expect(result.ran).toBe(true);
    expect(result.lead.status).toBe("READY_FOR_REVIEW");
    expect(result.lead.qualification.tier).not.toBe("UNASSESSED");
    expect(result.lead.draft.subject.length).toBeGreaterThan(0);
    expect(result.lead.draft.body.length).toBeGreaterThan(0);
    expect(result.executed).toEqual([
      "validate",
      "research",
      "extract",
      "score",
      "draft",
      "review",
    ]);
  });

  it("is idempotent once the pipeline has completed", async () => {
    const providers = getProviderRegistry();
    const first = await runEnrichmentWorkflow(makeLead(), providers);
    const second = await runEnrichmentWorkflow(first.lead, providers);

    expect(second.ran).toBe(false);
    expect(second.executed).toEqual([]);
    expect(second.lead.draft.body).toBe(first.lead.draft.body);
    expect(second.lead.qualification.score).toBe(first.lead.qualification.score);
  });

  it("never regenerates a draft after approval", async () => {
    const providers = getProviderRegistry();
    const first = await runEnrichmentWorkflow(makeLead(), providers);
    const approved: Lead = {
      ...first.lead,
      status: "APPROVED",
      draft: { ...first.lead.draft, status: "APPROVED" },
    };

    const again = await runEnrichmentWorkflow(approved, providers);
    expect(again.ran).toBe(false);
    expect(again.lead.draft.body).toBe(first.lead.draft.body);
  });

  it("resumes only from the failed stage on retry", async () => {
    const providers = getProviderRegistry();
    const failed = withFailedResearch(makeLead());
    const resumed = await runEnrichmentWorkflow(failed, providers);

    expect(resumed.ran).toBe(true);
    expect(resumed.executed).not.toContain("validate");
    expect(resumed.executed[0]).toBe("research");
    expect(resumed.lead.status).toBe("READY_FOR_REVIEW");
  });

  it("produces deterministic output for the same company", async () => {
    const providers = getProviderRegistry();
    const a = await runEnrichmentWorkflow(
      makeLead({ website: "repeatable-co.com" }),
      providers,
    );
    const b = await runEnrichmentWorkflow(
      makeLead({ website: "repeatable-co.com" }),
      providers,
    );

    expect(a.lead.qualification.score).toBe(b.lead.qualification.score);
    expect(a.lead.qualification.tier).toBe(b.lead.qualification.tier);
    expect(a.lead.draft.body).toBe(b.lead.draft.body);
  });

  it("labels each evidence item as source (with URL) or inference", async () => {
    const providers = getProviderRegistry();
    const result = await runEnrichmentWorkflow(
      makeLead({ website: "evidence-co.com" }),
      providers,
    );

    expect(result.lead.enrichment.evidence.length).toBeGreaterThan(0);
    for (const item of result.lead.enrichment.evidence) {
      if (item.kind === "source") {
        expect(item.sourceUrl).toBeTruthy();
      } else {
        expect(item.sourceUrl).toBeNull();
      }
    }
  });

  it("flags free email without disqualifying and lowers data confidence", async () => {
    const providers = getProviderRegistry();
    const business = await runEnrichmentWorkflow(
      makeLead({ website: "same-domain-co.com", workEmail: "lead@acme.com" }),
      providers,
    );
    const free = await runEnrichmentWorkflow(
      makeLead({ website: "same-domain-co.com", workEmail: "lead@gmail.com" }),
      providers,
    );

    expect(
      free.lead.qualification.riskFlags.some((flag) => flag.code === "FREE_EMAIL"),
    ).toBe(true);
    expect(free.lead.qualification.tier).not.toBe("DISQUALIFIED");

    const dataConfidence = (lead: typeof free.lead) =>
      lead.qualification.criteria.find((c) => c.key === "dataConfidence")
        ?.score ?? 0;

    expect(dataConfidence(free.lead)).toBeLessThan(
      dataConfidence(business.lead),
    );
  });
});
