import "server-only";

import type { RiskFlag } from "@/contracts";
import { isFreeEmail } from "@/contracts";

export interface RiskContext {
  workEmail: string;
  websiteReachable: boolean;
  /** True when the website could not be fetched at all in demo mode. */
  researchSucceeded: boolean;
  hasSummary: boolean;
  hasPainPoints: boolean;
  confidence: "high" | "medium" | "low";
}

/**
 * Risk flags are shown in the UI but never used to silently reject a lead.
 * Free-email leads in particular stay in the pipeline.
 */
export function buildRiskFlags(context: RiskContext): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (isFreeEmail(context.workEmail)) {
    flags.push({
      code: "FREE_EMAIL",
      label: "Free email provider",
      severity: "medium",
    });
  }

  if (!context.researchSucceeded || !context.websiteReachable) {
    flags.push({
      code: "WEBSITE_UNREACHABLE",
      label: "Website could not be fully retrieved",
      severity: "high",
    });
  }

  if (!context.hasSummary || !context.hasPainPoints) {
    flags.push({
      code: "INCOMPLETE_DATA",
      label: "Company intelligence is incomplete",
      severity: "medium",
    });
  }

  if (context.confidence === "low") {
    flags.push({
      code: "LOW_CONFIDENCE",
      label: "Low-confidence evidence",
      severity: "low",
    });
  }

  return flags;
}
