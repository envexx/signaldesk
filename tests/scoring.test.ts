import { describe, expect, it } from "vitest";

import { buildRiskFlags } from "@/lib/server/domain/risk";
import {
  buildCriteria,
  buildQualification,
  computeScore,
  tierForScore,
  unscoredQualification,
} from "@/lib/server/domain/scoring";

describe("tierForScore boundaries", () => {
  it("labels 75-100 as HIGH_PRIORITY", () => {
    expect(tierForScore(100)).toBe("HIGH_PRIORITY");
    expect(tierForScore(75)).toBe("HIGH_PRIORITY");
  });

  it("labels 45-74 as MEDIUM", () => {
    expect(tierForScore(74)).toBe("MEDIUM");
    expect(tierForScore(45)).toBe("MEDIUM");
  });

  it("labels 0-44 as DISQUALIFIED", () => {
    expect(tierForScore(44)).toBe("DISQUALIFIED");
    expect(tierForScore(0)).toBe("DISQUALIFIED");
  });
});

describe("criterion clamping", () => {
  it("clamps values into each criterion's max and never negative", () => {
    const criteria = buildCriteria({
      companyFit: 999,
      problemFit: -10,
      buyingSignal: 10,
      dataConfidence: 15,
    });

    expect(criteria.find((c) => c.key === "companyFit")?.score).toBe(35);
    expect(criteria.find((c) => c.key === "problemFit")?.score).toBe(0);
    expect(computeScore(criteria)).toBe(60);
    expect(tierForScore(computeScore(criteria))).toBe("MEDIUM");
  });

  it("sums to at most 100", () => {
    const criteria = buildCriteria({
      companyFit: 35,
      problemFit: 30,
      buyingSignal: 20,
      dataConfidence: 15,
    });
    expect(computeScore(criteria)).toBe(100);
    expect(tierForScore(computeScore(criteria))).toBe("HIGH_PRIORITY");
  });
});

describe("buildQualification", () => {
  it("derives tier from the computed total, not from a suggested tier", () => {
    const qualification = buildQualification(
      { companyFit: 34, problemFit: 28, buyingSignal: 18, dataConfidence: 14 },
      [],
      new Date().toISOString(),
    );
    expect(qualification.score).toBe(94);
    expect(qualification.tier).toBe("HIGH_PRIORITY");
    expect(qualification.reasoning).toContain("94/100");
  });

  it("mentions risk flags in the reasoning", () => {
    const risks = buildRiskFlags({
      workEmail: "founder@gmail.com",
      websiteReachable: true,
      researchSucceeded: true,
      hasSummary: true,
      hasPainPoints: true,
      confidence: "high",
    });
    expect(risks.some((flag) => flag.code === "FREE_EMAIL")).toBe(true);
    const qualification = buildQualification(
      { companyFit: 20, problemFit: 15, buyingSignal: 10, dataConfidence: 10 },
      risks,
      new Date().toISOString(),
    );
    expect(qualification.reasoning.toLowerCase()).toContain("free email");
  });
});

describe("unscoredQualification", () => {
  it("starts as UNASSESSED with no score", () => {
    const qualification = unscoredQualification();
    expect(qualification.tier).toBe("UNASSESSED");
    expect(qualification.score).toBe(0);
    expect(qualification.scoredAt).toBeNull();
  });
});
