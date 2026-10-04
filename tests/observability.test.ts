import { describe, expect, it, vi } from "vitest";

import { log, maskEmail } from "@/lib/server/observability/logger";

describe("maskEmail", () => {
  it("keeps the domain but hides most of the local part", () => {
    expect(maskEmail("maya@acme.com")).toBe("m***@acme.com");
    expect(maskEmail("not-an-email")).toBe("***");
  });
});

describe("structured logging", () => {
  it("redacts secrets and masks emails in the JSON line", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      log("info", "lead captured", {
        apiKey: "super-secret-value",
        contact: "maya@acme.com",
        outcome: "captured",
      });

      const line = spy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(line) as Record<string, unknown>;

      expect(parsed.level).toBe("info");
      expect(parsed.apiKey).toBe("[redacted]");
      expect(parsed.contact).toBe("m***@acme.com");
      expect(parsed.outcome).toBe("captured");
    } finally {
      spy.mockRestore();
    }
  });
});
