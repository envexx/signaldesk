import "server-only";

import type { EvidenceItem } from "@/contracts";

import type {
  CompanyResearchResult,
  DraftRequest,
  ExtractedIntelligence,
  GeneratedDraft,
  LeadIntelligenceProvider,
  NormalizedLeadInput,
} from "../types";
import { intBetween, pick, pickMany, shuffled } from "./deterministic";

const INDUSTRIES = [
  "Logistics & Supply Chain",
  "Healthcare Technology",
  "Real Estate",
  "Retail & E-commerce",
  "Industrial Manufacturing",
  "Professional Services",
  "Financial Services",
  "Software & Internet",
];

const SIZES = ["1-10", "11-50", "51-200", "201-500", "500-1,000", "1,000+"];

const BUSINESS_MODELS = [
  "B2B SaaS",
  "B2B services",
  "Marketplace",
  "Subscription commerce",
  "Enterprise software",
];

const LOCATIONS = [
  "United States",
  "United Kingdom",
  "Germany",
  "Netherlands",
  "Singapore",
  "Australia",
  "Canada",
  "Indonesia",
];

const TECHNOLOGIES = [
  "HubSpot",
  "Salesforce",
  "Segment",
  "Snowflake",
  "Zapier",
  "Shopify",
  "Stripe",
  "Intercom",
  "Notion",
  "Webflow",
  "NetSuite",
  "Twilio",
];

const PAIN_POINTS = [
  "manual lead routing between marketing and sales",
  "inconsistent enrichment data across the CRM",
  "slow follow-up on inbound enquiries",
  "duplicate and stale contact records",
  "no reliable reporting on pipeline velocity",
  "fragmented customer data across tools",
];

const CRITERION_RANGES = {
  companyFit: [18, 33] as const,
  problemFit: [13, 28] as const,
  buyingSignal: [7, 18] as const,
  dataConfidence: [8, 15] as const,
};

function overallConfidence(seed: string): "high" | "medium" | "low" {
  const bucket = intBetween(`${seed}:confidence`, 0, 9);
  if (bucket >= 7) return "high";
  if (bucket >= 2) return "medium";
  return "low";
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * Deterministic demo intelligence + drafting provider. Output is derived only
 * from the lead identity and the (demo) research result — no fabricated
 * funding, headcount, customers, or news.
 */
export class DemoLeadIntelligenceProvider implements LeadIntelligenceProvider {
  readonly name = "demo-lead-intelligence";
  readonly mode = "demo" as const;

  async extract(
    input: NormalizedLeadInput,
    research: CompanyResearchResult,
  ): Promise<ExtractedIntelligence> {
    const { company } = input;
    const seed = company.domain;

    const industry = pick(INDUSTRIES, `${seed}:industry`);
    const estimatedSize = pick(SIZES, `${seed}:size`);
    const businessModel = pick(BUSINESS_MODELS, `${seed}:model`);
    const location = pick(LOCATIONS, `${seed}:location`);
    const technologies = pickMany(
      TECHNOLOGIES,
      `${seed}:tech`,
      intBetween(`${seed}:techCount`, 3, 5),
    );
    const painPoints = pickMany(
      PAIN_POINTS,
      `${seed}:pain`,
      intBetween(`${seed}:painCount`, 2, 3),
    );
    const confidence = overallConfidence(seed);

    const summary =
      `${company.name} is a ${estimatedSize}-person ${industry.toLowerCase()} ` +
      `business (${businessModel}) based in ${location}. Its public site ` +
      `positions it around ${research.title.split("—")[1]?.trim() ?? "its core product"}.`;

    const evidence: EvidenceItem[] = [
      {
        id: `${seed}:headline`,
        label: "Homepage headline",
        detail: research.title,
        sourceUrl: research.sourceUrl,
        kind: "source",
        confidence: "high",
      },
      {
        id: `${seed}:excerpt`,
        label: "Website excerpt",
        detail: research.description,
        sourceUrl: research.sourceUrl,
        kind: "source",
        confidence: confidence === "high" ? "high" : "medium",
      },
      {
        id: `${seed}:tech`,
        label: "Detected technologies",
        detail: technologies.join(", "),
        sourceUrl: null,
        kind: "inference",
        confidence: "medium",
      },
      {
        id: `${seed}:pain`,
        label: "Likely operational pain",
        detail: painPoints.join("; "),
        sourceUrl: null,
        kind: "inference",
        confidence: confidence === "low" ? "low" : "medium",
      },
      {
        id: `${seed}:size`,
        label: "Estimated company size",
        detail: `${estimatedSize} employees`,
        sourceUrl: null,
        kind: "inference",
        confidence: "low",
      },
    ];

    const criterionSuggestions = {
      companyFit: intBetween(
        `${seed}:companyFit`,
        CRITERION_RANGES.companyFit[0],
        CRITERION_RANGES.companyFit[1],
      ),
      problemFit: intBetween(
        `${seed}:problemFit`,
        CRITERION_RANGES.problemFit[0],
        CRITERION_RANGES.problemFit[1],
      ),
      buyingSignal: intBetween(
        `${seed}:buyingSignal`,
        CRITERION_RANGES.buyingSignal[0],
        CRITERION_RANGES.buyingSignal[1],
      ),
      dataConfidence:
        research.reachable && confidence !== "low"
          ? intBetween(
              `${seed}:dataConfidence`,
              CRITERION_RANGES.dataConfidence[0],
              CRITERION_RANGES.dataConfidence[1],
            )
          : intBetween(`${seed}:dataConfidenceLow`, 3, 7),
    };

    return {
      summary,
      industry,
      estimatedSize,
      businessModel,
      location,
      technologies,
      painPoints,
      evidence,
      confidence,
      criterionSuggestions,
    };
  }

  async draft(request: DraftRequest): Promise<GeneratedDraft> {
    const { input, intelligence, topPainPoint } = request;
    const { company } = input;
    const contactName = firstName(input.contact.fullName);
    const pain = topPainPoint ?? intelligence.painPoints[0] ?? "inbound follow-up";
    const proof =
      intelligence.technologies.length > 0
        ? intelligence.technologies.slice(0, 2).join(" and ")
        : "your current stack";
    const subject = `Following up on ${company.name}'s inbound enquiry`;
    const body = [
      `Hi ${contactName},`,
      "",
      `Thanks for reaching out. I took a look at ${company.name} and noted that ${pain} is a common friction point for teams scaling past manual processes.`,
      "",
      `Based on what is publicly visible, you are working with ${proof}. We help teams like yours connect inbound signals to enrichment and follow-up so nothing waits on a manual handoff.`,
      "",
      `Worth a short 15-minute call to see whether this is relevant? If not, I am happy to point you to a resource instead.`,
      "",
      "Best,",
      "The SignalDesk team",
    ].join("\n");

    return { subject, body };
  }
}

/** Exposed for tests/seed builders that need deterministic ordering. */
export function orderedPainPoints(seed: string): string[] {
  return shuffled(PAIN_POINTS, seed);
}
