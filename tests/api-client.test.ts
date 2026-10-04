import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getLead,
  listLeads,
  SignalDeskApiError,
} from "@/lib/client/signaldesk-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignalDesk API client", () => {
  it("unwraps the success envelope and forwards query params", async () => {
    let capturedUrl = "";
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      capturedUrl = String(url);
      return jsonResponse({ data: [{ id: "lead_1" }], meta: { total: 1 } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const leads = await listLeads({ q: "acme", tier: "HIGH_PRIORITY", limit: 50 });

    expect(leads).toEqual([{ id: "lead_1" }]);
    expect(capturedUrl).toContain("/api/leads?");
    expect(capturedUrl).toContain("q=acme");
    expect(capturedUrl).toContain("tier=HIGH_PRIORITY");
    expect(capturedUrl).toContain("limit=50");
  });

  it("throws a typed error carrying code, status, and fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "The request payload is invalid",
              fields: { workEmail: ["Enter a valid email address"] },
            },
          },
          400,
        ),
      ),
    );

    await expect(getLead("missing")).rejects.toMatchObject({
      name: "SignalDeskApiError",
      code: "VALIDATION_ERROR",
      status: 400,
      fields: { workEmail: ["Enter a valid email address"] },
    });
    await expect(getLead("missing")).rejects.toBeInstanceOf(SignalDeskApiError);
  });

  it("surfaces transport failures as a REQUEST_FAILED error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(listLeads()).rejects.toMatchObject({
      code: "REQUEST_FAILED",
      status: 0,
    });
  });
});
