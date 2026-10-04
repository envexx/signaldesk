import { describe, expect, it } from "vitest";

import { createLead } from "@/lib/server/services/lead-service";
import {
  approveLead,
  processLead,
  sendLead,
} from "@/lib/server/services/enrichment-service";
import { listLeadDeliveries } from "@/lib/server/services/outbox-service";

function uniqueIntake() {
  const suffix = Math.random().toString(36).slice(2, 10);
  return {
    fullName: "Send Candidate",
    workEmail: `send.${suffix}@delivery-widgets.com`,
    companyWebsite: "delivery-widgets.com",
    companyName: "Delivery Widgets",
  };
}

describe("send guard", () => {
  it("rejects sending before approval", async () => {
    const lead = await createLead(uniqueIntake(), { source: "test" });
    await processLead(lead.id);

    await expect(sendLead(lead.id)).rejects.toMatchObject({
      code: "NOT_READY",
    });
  });

  it("records a simulated delivery in demo mode and marks the lead SENT", async () => {
    const lead = await createLead(uniqueIntake(), { source: "test" });
    await processLead(lead.id);
    await approveLead(lead.id, { confirm: true });

    const result = await sendLead(lead.id);

    expect(result.lead.status).toBe("SENT");
    expect(result.lead.draft.status).toBe("SENT");
    expect(result.delivery).toBeNull();

    const deliveries = await listLeadDeliveries(lead.id);
    expect(deliveries.length).toBeGreaterThan(0);
    expect(deliveries[0]?.status).toBe("SIMULATED");
    expect(deliveries[0]?.provider).toBe("demo");
  });
});
