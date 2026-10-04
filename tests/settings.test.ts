import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  getSettings,
  updateSettings,
} from "@/lib/server/services/settings-service";

describe("workspace settings", () => {
  it("returns useful defaults before anything is saved", async () => {
    const settings = await getSettings();
    expect(settings.targetProspect.industries.length).toBeGreaterThan(0);
    expect(settings.companyContext.valueProposition.length).toBeGreaterThan(0);
    expect(settings.email.provider).toBe("demo");
    expect(settings.email).not.toHaveProperty("apiKey");
  });

  it("persists updates and never returns secret values", async () => {
    const updated = await updateSettings({
      targetProspect: {
        ...DEFAULT_SETTINGS.targetProspect,
        industries: ["Fintech"],
      },
      companyContext: {
        ...DEFAULT_SETTINGS.companyContext,
        companyName: "Acme Growth",
        signature: "The Acme team",
      },
      email: {
        provider: "resend",
        fromEmail: "outreach@acme.io",
        fromName: "Acme",
        replyTo: "",
        enabled: true,
        apiKey: "re_test_key",
      },
      webhooks: {
        inboundSignatureEnabled: true,
        resendSignatureEnabled: false,
        inboundSecret: "whsec_inbound",
      },
    });

    expect(updated.companyContext.companyName).toBe("Acme Growth");
    expect(updated.updatedAt).not.toBeNull();
    expect(updated.email.hasApiKey).toBe(true);
    expect(updated.email).not.toHaveProperty("apiKey");
    expect(updated.webhooks.hasInboundSecret).toBe(true);
    expect(updated.webhooks).not.toHaveProperty("inboundSecret");

    const reloaded = await getSettings();
    expect(reloaded.targetProspect.industries).toEqual(["Fintech"]);
    expect(reloaded.email.provider).toBe("resend");
    expect(reloaded.email.hasApiKey).toBe(true);
  });
});
