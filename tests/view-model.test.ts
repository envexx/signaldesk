import { describe, expect, it } from "vitest";

import { toViewLead } from "@/lib/client/view-model";
import { getProviderRegistry } from "@/lib/server/providers";
import { runEnrichmentWorkflow } from "@/lib/server/workflows/enrichment-workflow";

import { makeLead } from "./helpers";

async function enrichedCanonicalLead() {
  const result = await runEnrichmentWorkflow(
    makeLead({
      fullName: "Maya Chen",
      workEmail: "maya@auroragrid.io",
      website: "auroragrid.io",
      companyName: "AuroraGrid",
    }),
    getProviderRegistry(),
  );
  return result.lead;
}

describe("toViewLead mapping", () => {
  it("flattens canonical contact fields and derives initials", async () => {
    const view = toViewLead(await enrichedCanonicalLead());

    expect(view.fullName).toBe("Maya Chen");
    expect(view.initials).toBe("MC");
    expect(view.workEmail).toBe("maya@auroragrid.io");
    expect(view.company.name).toBe("AuroraGrid");
  });

  it("turns criteria array into the UI criteria object", async () => {
    const view = toViewLead(await enrichedCanonicalLead());

    expect(view.qualification.criteria.companyFit).toBeGreaterThan(0);
    expect(view.qualification.criteria.problemFit).toBeGreaterThan(0);
    expect(view.qualification.criteria.buyingSignal).toBeGreaterThan(0);
    expect(view.qualification.criteria.dataConfidence).toBeGreaterThan(0);
    expect(view.qualification.score).toBeGreaterThan(0);
  });

  it("converts risk flags to labels and confidence to uppercase", async () => {
    const view = toViewLead(await enrichedCanonicalLead());

    for (const flag of view.qualification.riskFlags) {
      expect(typeof flag).toBe("string");
    }
    expect(["HIGH", "MEDIUM", "LOW"]).toContain(view.enrichment.confidence);
  });

  it("maps workflow steps to the timeline view-model", async () => {
    const view = toViewLead(await enrichedCanonicalLead());
    const research = view.workflow.find((step) => step.id === "research");

    expect(view.workflow.map((step) => step.id)).toContain("draft");
    expect(research?.status).toBe("SUCCEEDED");
    expect(research?.title).toBe("Website researched");
    expect(typeof view.processingDurationMs).toBe("number");
    expect(view.processingDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("maps evidence source to a website URL and inference without url", async () => {
    const view = toViewLead(await enrichedCanonicalLead());
    const source = view.enrichment.evidence.find(
      (item) => item.sourceType === "WEBSITE",
    );
    const inference = view.enrichment.evidence.find(
      (item) => item.sourceType === "AI_INFERENCE",
    );

    expect(source?.url).toContain("https://");
    expect(inference?.url).toBeUndefined();
  });
});
