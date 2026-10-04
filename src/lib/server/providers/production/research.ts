import "server-only";

import { ProviderFailureError } from "@/lib/server/domain/errors";

import type {
  CompanyResearchProvider,
  CompanyResearchResult,
  NormalizedLeadInput,
} from "../types";

const SCRAPE_ENDPOINT = "https://api.firecrawl.dev/v1/scrape";
const MAP_ENDPOINT = "https://api.firecrawl.dev/v1/map";
const SCRAPE_TIMEOUT_MS = 25_000;
const MAP_TIMEOUT_MS = 15_000;
const MAX_PAGES = 5;
const MAX_EXCERPT_CHARS = 12_000;
const MAX_CHARS_PER_PAGE = 4_000;

const INCLUDE_KEYWORDS = [
  "about",
  "company",
  "service",
  "services",
  "solution",
  "solutions",
  "product",
  "products",
  "platform",
  "pricing",
  "plans",
  "team",
  "contact",
  "technology",
  "capabilities",
  "why",
];

const EXCLUDE_KEYWORDS = [
  "blog",
  "news",
  "career",
  "jobs",
  "login",
  "signin",
  "sign-up",
  "signup",
  "privacy",
  "terms",
  "cookie",
  "legal",
  "wp-admin",
  "cart",
  "checkout",
  "tag",
  "author",
];

interface FirecrawlScrapeResponse {
  success?: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
    };
  };
}

interface FirecrawlMapResponse {
  success?: boolean;
  links?: Array<string | { url?: string; title?: string }>;
}

interface FetchedPage {
  url: string;
  title: string;
  description: string;
  markdown: string;
  html: string;
}

const TECH_SIGNATURES: Array<{ label: string; pattern: RegExp }> = [
  { label: "WordPress", pattern: /wp-content|wp-includes|wordpress/i },
  { label: "Next.js", pattern: /__NEXT_DATA__|\/_next\/static/i },
  { label: "React", pattern: /data-reactroot|react(?:-dom)?\.production\.min\.js/i },
  { label: "Vue.js", pattern: /data-v-[0-9a-f]{6,}|vue(?:\.runtime)?\.min\.js/i },
  { label: "HubSpot", pattern: /hs-scripts|hsforms|hubspot/i },
  { label: "Google Analytics", pattern: /googletagmanager|gtag\/js|google-analytics/i },
  { label: "Google Tag Manager", pattern: /googletagmanager\.com\/gtm/i },
  { label: "Cloudflare", pattern: /cdn-cgi|cloudflare/i },
  { label: "Shopify", pattern: /cdn\.shopify|shopify\.com/i },
  { label: "Webflow", pattern: /webflow/i },
  { label: "Wix", pattern: /wixstatic|wix\.com/i },
  { label: "Squarespace", pattern: /squarespace/i },
  { label: "Tailwind CSS", pattern: /tailwindcss|tailwind\.min\.css/i },
  { label: "Bootstrap", pattern: /bootstrap(?:\.min)?\.(?:css|js)/i },
  { label: "jQuery", pattern: /jquery/i },
  { label: "Intercom", pattern: /intercom/i },
  { label: "Drift", pattern: /js\.driftt|drift\.com/i },
  { label: "Zendesk", pattern: /zendesk/i },
  { label: "Segment", pattern: /cdn\.segment\.com|analytics\.min\.js/i },
  { label: "Mixpanel", pattern: /mixpanel/i },
  { label: "Hotjar", pattern: /hotjar/i },
  { label: "Microsoft Clarity", pattern: /clarity\.ms/i },
  { label: "Stripe", pattern: /js\.stripe|stripe\.com\/v3/i },
  { label: "Vercel", pattern: /vercel/i },
  { label: "Netlify", pattern: /netlify/i },
  { label: "AWS CloudFront", pattern: /cloudfront\.net|amazonaws\.com/i },
  { label: "Salesforce", pattern: /salesforce|force\.com/i },
  { label: "Marketo", pattern: /marketo|mktoresp/i },
  { label: "LinkedIn Insight Tag", pattern: /snap\.licdn\.com/i },
];

function detectTechnologies(html: string): string[] {
  const found: string[] = [];
  for (const signature of TECH_SIGNATURES) {
    if (signature.pattern.test(html)) found.push(signature.label);
    if (found.length >= 12) break;
  }
  return found;
}

function normalizeLink(
  link: string | { url?: string; title?: string },
): string | null {
  if (typeof link === "string") return link;
  if (link && typeof link.url === "string") return link.url;
  return null;
}

export class FirecrawlCompanyResearchProvider implements CompanyResearchProvider {
  readonly name = "firecrawl-company-research";
  readonly mode = "production" as const;

  constructor(private readonly apiKey: string) {}

  private async post<T>(
    endpoint: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) return null;
      return (await response.json().catch(() => null)) as T | null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async discoverPages(input: NormalizedLeadInput): Promise<string[]> {
    const origins = new Set<string>([input.company.website]);

    const mapped = await this.post<FirecrawlMapResponse>(
      MAP_ENDPOINT,
      { url: input.company.website, limit: 60, includeSubdomains: false },
      MAP_TIMEOUT_MS,
    );

    const candidates: string[] = [];
    for (const raw of mapped?.links ?? []) {
      const url = normalizeLink(raw);
      if (url) candidates.push(url);
    }

    const host = input.company.domain;
    const relevant = candidates.filter((url) => {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname.toLowerCase();
        if (parsed.hostname.replace(/^www\./, "") !== host) return false;
        if (parsed.search) return false;
        return !EXCLUDE_KEYWORDS.some((keyword) => path.includes(keyword));
      } catch {
        return false;
      }
    });

    const scored = relevant
      .map((url) => {
        const path = new URL(url).pathname.toLowerCase();
        const score = INCLUDE_KEYWORDS.reduce(
          (total, keyword) => (path.includes(keyword) ? total + 1 : total),
          0,
        );
        return { url, score };
      })
      .sort((a, b) => b.score - a.score);

    for (const item of scored) {
      if (origins.size >= MAX_PAGES) break;
      origins.add(item.url);
    }

    return [...origins].slice(0, MAX_PAGES);
  }

  private async scrape(url: string): Promise<FetchedPage | null> {
    const payload = await this.post<FirecrawlScrapeResponse>(
      SCRAPE_ENDPOINT,
      { url, formats: ["markdown", "html"], onlyMainContent: true },
      SCRAPE_TIMEOUT_MS,
    );
    const markdown = payload?.data?.markdown?.trim() ?? "";
    if (!payload?.success || markdown.length === 0) return null;

    return {
      url: payload.data?.metadata?.sourceURL?.trim() || url,
      title: payload.data?.metadata?.title?.trim() || "",
      description: payload.data?.metadata?.description?.trim() || "",
      markdown,
      html: payload.data?.html ?? "",
    };
  }

  async research(input: NormalizedLeadInput): Promise<CompanyResearchResult> {
    const urls = await this.discoverPages(input);
    const settled = await Promise.allSettled(urls.map((url) => this.scrape(url)));

    const pages: FetchedPage[] = [];
    let homepageTitle = "";
    let homepageDescription = "";

    for (const result of settled) {
      if (result.status !== "fulfilled" || !result.value) continue;
      if (pages.length === 0) {
        homepageTitle = result.value.title;
        homepageDescription = result.value.description;
      }
      pages.push(result.value);
    }

    if (pages.length === 0) {
      throw new ProviderFailureError(
        "Company research could not retrieve any page",
        "RESEARCH_FAILED",
      );
    }

    const combined = pages
      .map((page) => {
        const body = page.markdown.slice(0, MAX_CHARS_PER_PAGE);
        return `--- ${page.title || page.url} (${page.url}) ---\n${body}`;
      })
      .join("\n\n")
      .slice(0, MAX_EXCERPT_CHARS);

    const htmlCombined = pages
      .map((page) => page.html.slice(0, 150_000))
      .join("\n");

    return {
      website: input.company.website,
      domain: input.company.domain,
      reachable: true,
      title: homepageTitle || input.company.name,
      description:
        homepageDescription ||
        pages[0].markdown.slice(0, 240).replace(/\s+/g, " "),
      sourceUrl: pages[0].url,
      excerpt: combined,
      pages: pages.map((page) => ({
        url: page.url,
        title: page.title || page.url,
      })),
      detectedTechnologies: detectTechnologies(htmlCombined),
      fetchedAt: new Date().toISOString(),
    };
  }
}
