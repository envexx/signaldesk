import { describe, expect, it } from "vitest";

import {
  companyNameFromDomain,
  isFreeEmail,
  normalizeEmail,
  normalizeWebsite,
} from "@/contracts";

describe("normalizeWebsite", () => {
  it("adds https and strips www", () => {
    expect(normalizeWebsite("acme.com")).toEqual({
      website: "https://acme.com",
      domain: "acme.com",
    });
    expect(normalizeWebsite("http://www.Acme.com/pricing?ref=1")).toEqual({
      website: "https://acme.com",
      domain: "acme.com",
    });
  });

  it("rejects values that are not plausible hostnames", () => {
    expect(normalizeWebsite("not a url")).toBeNull();
    expect(normalizeWebsite("localhost")).toBeNull();
    expect(normalizeWebsite("")).toBeNull();
  });
});

describe("email normalization", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo.Bar@Acme.COM ")).toBe("foo.bar@acme.com");
  });

  it("flags free providers without rejecting them", () => {
    expect(isFreeEmail("founder@gmail.com")).toBe(true);
    expect(isFreeEmail("founder@acme.com")).toBe(false);
  });
});

describe("companyNameFromDomain", () => {
  it("derives a readable name from the domain label", () => {
    expect(companyNameFromDomain("northwind-logistics.com")).toBe(
      "Northwind Logistics",
    );
  });
});
