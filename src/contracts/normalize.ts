/**
 * Pure normalization helpers shared between validation (API layer) and the
 * domain layer. No server-only imports so these can also run in the browser.
 */

/** Common consumer mailbox providers; presence produces a risk flag, not a rejection. */
export const FREE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.de",
  "mail.com",
  "yandex.com",
  "zoho.com",
  "pm.me",
]);

export interface NormalizedWebsite {
  /** Canonical `https://` origin, e.g. `https://acme.com`. */
  website: string;
  /** Canonical hostname without `www.`, e.g. `acme.com`. */
  domain: string;
}

function stripWww(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

/**
 * Normalize an arbitrary website string to an HTTPS origin.
 * Returns `null` when the value cannot be parsed into a plausible hostname.
 */
export function normalizeWebsite(raw: string): NormalizedWebsite | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const domain = stripWww(url.hostname);
  // Require at least one dot and a TLD-ish suffix; reject localhost & bare hosts.
  if (!domain.includes(".") || domain.endsWith(".")) return null;
  const tld = domain.split(".").pop() ?? "";
  if (tld.length < 2 || !/^[a-z0-9-]+$/.test(tld)) return null;

  return { website: `https://${domain}`, domain };
}

/** Normalize an email address to lowercase, trimmed form. */
export function normalizeEmail(raw: string): string {
  return raw?.trim().toLowerCase() ?? "";
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

export function isFreeEmail(email: string): boolean {
  const domain = emailDomain(normalizeEmail(email));
  return domain !== null && FREE_EMAIL_DOMAINS.has(domain);
}

/**
 * Derive a human-friendly company name from a domain when the caller did not
 * provide one, e.g. `northwind-logistics.com` -> `Northwind Logistics`.
 */
export function companyNameFromDomain(domain: string): string {
  const label =
    domain.split(".").slice(0, -1).join(".").split(".").pop() ?? domain;
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** URL-safe slug used for deterministic ids. */
export function slugify(value: string, maxLength = 40): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, maxLength) || "item";
}
