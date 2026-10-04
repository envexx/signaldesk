import { describe, expect, it } from "vitest";

import { ingestWebhookLead, type LeadIntake } from "@/lib/server/services/lead-service";

function intake(suffix: string): LeadIntake {
  return {
    fullName: `Webhook ${suffix}`,
    workEmail: `webhook.${suffix}@inbound-widgets.com`,
    companyWebsite: "inbound-widgets.com",
    companyName: "Inbound Widgets",
  };
}

describe("inbound webhook idempotency", () => {
  it("returns the same lead when the Idempotency-Key repeats", async () => {
    const key = `test-key-${Math.random().toString(36).slice(2)}`;
    const first = await ingestWebhookLead(intake("dup"), key);
    const second = await ingestWebhookLead(intake("dup"), key);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.lead.id).toBe(first.lead.id);
  });

  it("creates distinct leads when no idempotency key is provided", async () => {
    const first = await ingestWebhookLead(intake("nokey"), null);
    const second = await ingestWebhookLead(intake("nokey"), null);

    expect(second.lead.id).not.toBe(first.lead.id);
  });
});
