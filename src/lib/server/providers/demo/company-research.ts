import "server-only";

import type {
  CompanyResearchProvider,
  CompanyResearchResult,
  NormalizedLeadInput,
} from "../types";
import { intBetween, pick } from "./deterministic";

const TAGLINES = [
  "operations platform",
  "customer data platform",
  "team workspace",
  "supply chain toolkit",
  "revenue operations suite",
  "vertical SaaS product",
];

const SECTORS = [
  "logistics",
  "healthcare",
  "real estate",
  "retail",
  "manufacturing",
  "professional services",
  "fintech",
];

const DEMO_QUOTE = [
  "We are expanding the team this quarter and reviewing our tooling.",
  "Our team is drowning in manual handoffs between tools.",
  "We just started a project to consolidate our internal workflows.",
  "We are evaluating new software to reduce manual data entry.",
];

/**
 * Deterministic demo research provider. No network access; produces a stable,
 * plausible page summary so the workflow can run without credentials.
 */
export class DemoCompanyResearchProvider implements CompanyResearchProvider {
  readonly name = "demo-company-research";
  readonly mode = "demo" as const;

  async research(input: NormalizedLeadInput): Promise<CompanyResearchResult> {
    const { company } = input;
    const seed = company.domain;
    const tagline = pick(TAGLINES, `${seed}:tagline`);
    const sector = pick(SECTORS, `${seed}:sector`);
    const quote = pick(DEMO_QUOTE, `${seed}:quote`);
    const teamSize = intBetween(`${seed}:team`, 8, 240);

    return {
      website: company.website,
      domain: company.domain,
      reachable: true,
      title: `${company.name} — ${tagline}`,
      description: `${company.name} builds a ${tagline} for ${sector} teams.`,
      excerpt:
        `Homepage summary for ${company.name}: a ${tagline} serving ${sector} ` +
        `customers. The team page references roughly ${teamSize} people. ` +
        `Careers note: "${quote}"`,
      sourceUrl: company.website,
      fetchedAt: new Date().toISOString(),
    };
  }
}
