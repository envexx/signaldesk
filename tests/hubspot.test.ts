import { afterEach, describe, expect, it, vi } from "vitest";

import { HubSpotCrmProvider } from "@/lib/server/providers/production/hubspot";

import { makeLead } from "./helpers";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HubSpot CRM adapter", () => {
  it("creates a contact when none exists", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${String(url)}`);
        if (String(url).includes("/search")) return json({ results: [] });
        return json({ id: "hs_1" });
      }),
    );

    const provider = new HubSpotCrmProvider("token");
    const result = await provider.upsertLead(makeLead());

    expect(result.externalId).toBe("hs_1");
    expect(calls.some((call) => call.startsWith("POST") && call.includes("/crm/v3/objects/contacts"))).toBe(true);
  });

  it("updates an existing contact found by email search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) =>
        String(url).includes("/search")
          ? json({ results: [{ id: "hs_9" }] })
          : json({ id: "hs_9" }),
      ),
    );

    const provider = new HubSpotCrmProvider("token");
    const result = await provider.upsertLead(makeLead());
    expect(result.externalId).toBe("hs_9");
  });

  it("maps HubSpot failures to a 502 CRM_FAILED error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ message: "boom" }, 500)),
    );

    const provider = new HubSpotCrmProvider("token");
    await expect(provider.upsertLead(makeLead())).rejects.toMatchObject({
      code: "CRM_FAILED",
      status: 502,
    });
  });
});
