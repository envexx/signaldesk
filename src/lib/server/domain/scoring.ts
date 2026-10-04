import "server-only";

import type {
  CriterionKey,
  Qualification,
  RiskFlag,
  ScoreCriterion,
  Tier,
} from "@/contracts";

/**
 * ICP scoring rubric. The LLM may *suggest* a value per criterion, but the
 * backend clamps, sums, and derives the tier deterministically. Total = 100.
 */
export const SCORING_RUBRIC: Record<
  CriterionKey,
  { label: string; max: number }
> = {
  companyFit: { label: "Company fit", max: 35 },
  problemFit: { label: "Problem fit", max: 30 },
  buyingSignal: { label: "Buying signal", max: 20 },
  dataConfidence: { label: "Data confidence", max: 15 },
};

export const CRITERION_ORDER: CriterionKey[] = [
  "companyFit",
  "problemFit",
  "buyingSignal",
  "dataConfidence",
];

export const TIER_THRESHOLDS = {
  highPriority: 75,
  medium: 45,
} as const;

export function tierForScore(score: number): Tier {
  if (score >= TIER_THRESHOLDS.highPriority) return "HIGH_PRIORITY";
  if (score >= TIER_THRESHOLDS.medium) return "MEDIUM";
  return "DISQUALIFIED";
}

function clampCriterion(key: CriterionKey, value: number): number {
  const max = SCORING_RUBRIC[key].max;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

function rationaleFor(key: CriterionKey, score: number, max: number): string {
  const ratio = max === 0 ? 0 : score / max;
  const band = ratio >= 0.75 ? "strong" : ratio >= 0.45 ? "partial" : "weak";
  const label = SCORING_RUBRIC[key].label;
  const bands: Record<string, string> = {
    strong: `${label} signal is strong against the ideal customer profile.`,
    partial: `${label} is only partially aligned with the ideal customer profile.`,
    weak: `${label} is weak or not yet supported by evidence.`,
  };
  return bands[band];
}

export function buildCriteria(
  suggestions: Partial<Record<CriterionKey, number>>,
): ScoreCriterion[] {
  return CRITERION_ORDER.map((key) => {
    const max = SCORING_RUBRIC[key].max;
    const score = clampCriterion(key, suggestions[key] ?? 0);
    return {
      key,
      label: SCORING_RUBRIC[key].label,
      score,
      max,
      rationale: rationaleFor(key, score, max),
    };
  });
}

export function computeScore(criteria: ScoreCriterion[]): number {
  return criteria.reduce((total, criterion) => total + criterion.score, 0);
}

export function buildReasoning(
  criteria: ScoreCriterion[],
  tier: Tier,
  riskFlags: RiskFlag[],
): string {
  const total = computeScore(criteria);
  const strongest = [...criteria].sort(
    (a, b) => b.score / b.max - a.score / a.max,
  )[0];
  const weakest = [...criteria].sort(
    (a, b) => a.score / a.max - b.score / b.max,
  )[0];

  const tierLine: Record<Tier, string> = {
    HIGH_PRIORITY: `Total ${total}/100 places this lead in the high-priority band.`,
    MEDIUM: `Total ${total}/100 places this lead in the medium band; qualify further before investing.`,
    DISQUALIFIED: `Total ${total}/100 falls below the qualification threshold.`,
    UNASSESSED: "This lead has not been scored yet.",
  };

  const parts = [tierLine[tier]];
  if (tier !== "UNASSESSED" && strongest && weakest) {
    parts.push(
      `Strongest on ${strongest.label.toLowerCase()} (${strongest.score}/${strongest.max}); weakest on ${weakest.label.toLowerCase()} (${weakest.score}/${weakest.max}).`,
    );
  }
  if (riskFlags.length > 0) {
    parts.push(
      `${riskFlags.length} risk flag${riskFlags.length > 1 ? "s" : ""} detected: ${riskFlags
        .map((flag) => flag.label.toLowerCase())
        .join(", ")}.`,
    );
  }
  return parts.join(" ");
}

export function buildQualification(
  suggestions: Partial<Record<CriterionKey, number>>,
  riskFlags: RiskFlag[],
  scoredAt: string,
): Qualification {
  const criteria = buildCriteria(suggestions);
  const score = computeScore(criteria);
  const tier = tierForScore(score);
  return {
    score,
    tier,
    reasoning: buildReasoning(criteria, tier, riskFlags),
    criteria,
    riskFlags,
    scoredAt,
  };
}

export function unscoredQualification(): Qualification {
  return {
    score: 0,
    tier: "UNASSESSED",
    reasoning: "This lead has not been scored yet.",
    criteria: buildCriteria({}),
    riskFlags: [],
    scoredAt: null,
  };
}
