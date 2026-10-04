import { describe, expect, it } from "vitest";

import { approveLeadSchema, sendLeadSchema } from "@/contracts";
import { createLead, getLeadById, updateLead } from "@/lib/server/services/lead-service";
import {
  approveLead,
  processLead,
  rejectLead,
} from "@/lib/server/services/enrichment-service";

function uniqueIntake() {
  const suffix = Math.random().toString(36).slice(2, 10);
  return {
    fullName: "Approval Candidate",
    workEmail: `candidate.${suffix}@approval-widgets.com`,
    companyWebsite: "approval-widgets.com",
    companyName: "Approval Widgets",
  };
}

describe("approval payload contract", () => {
  it("requires explicit confirmation", () => {
    expect(approveLeadSchema.safeParse({}).success).toBe(false);
    expect(approveLeadSchema.safeParse({ confirm: false }).success).toBe(false);
    expect(approveLeadSchema.safeParse({ confirm: true }).success).toBe(true);
  });

  it("requires explicit confirmation for send", () => {
    expect(sendLeadSchema.safeParse({}).success).toBe(false);
    expect(sendLeadSchema.safeParse({ confirm: true }).success).toBe(true);
  });
});

describe("approval guard", () => {
  it("rejects approval before enrichment has run", async () => {
    const lead = await createLead(uniqueIntake(), { source: "test" });
    expect(lead.status).toBe("CAPTURED");

    await expect(
      approveLead(lead.id, { confirm: true }),
    ).rejects.toMatchObject({ code: "NOT_READY" });
  });

  it("approves a processed draft and never sends externally in demo mode", async () => {
    const lead = await createLead(uniqueIntake(), { source: "test" });
    const processed = await processLead(lead.id);

    expect(processed.lead.status).toBe("READY_FOR_REVIEW");
    expect(processed.lead.draft.status).toBe("DRAFT");

    const approved = await approveLead(lead.id, { confirm: true });
    expect(approved.lead.status).toBe("APPROVED");
    expect(approved.lead.draft.status).toBe("APPROVED");
    expect(approved.alreadyApproved).toBe(false);
  });

  it("is idempotent when approving twice", async () => {
    const lead = await createLead(uniqueIntake(), { source: "test" });
    await processLead(lead.id);

    const first = await approveLead(lead.id, { confirm: true });
    const second = await approveLead(lead.id, { confirm: true });

    expect(first.alreadyApproved).toBe(false);
    expect(second.alreadyApproved).toBe(true);
    expect(second.lead.status).toBe("APPROVED");
  });

  it("rejects a stale draft version with a 409 conflict", async () => {
    const lead = await createLead(uniqueIntake(), { source: "test" });
    const processed = await processLead(lead.id);

    await expect(
      approveLead(lead.id, {
        confirm: true,
        version: processed.lead.draft.version + 10,
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it("returns an edited approved draft to review", async () => {
    const lead = await createLead(uniqueIntake(), { source: "test" });
    await processLead(lead.id);
    await approveLead(lead.id, { confirm: true });

    const edited = await updateLead(lead.id, {
      draft: { subject: "Updated after approval" },
    });

    expect(edited.status).toBe("READY_FOR_REVIEW");
    expect(edited.draft.status).toBe("DRAFT");
    expect(edited.draft.subject).toBe("Updated after approval");
  });

  it("increments draft version on every saved edit", async () => {
    const lead = await createLead(uniqueIntake(), { source: "test" });
    await processLead(lead.id);
    const before = await getLeadById(lead.id);

    const first = await updateLead(lead.id, { draft: { subject: "First" } });
    const second = await updateLead(lead.id, { draft: { body: "Second body" } });

    expect(first.draft.version).toBe(before.draft.version + 1);
    expect(second.draft.version).toBe(before.draft.version + 2);
  });

  it("rejects a ready draft and returns it to review", async () => {
    const lead = await createLead(uniqueIntake(), { source: "test" });
    await processLead(lead.id);

    const rejected = await rejectLead(lead.id);
    expect(rejected.lead.draft.status).toBe("REJECTED");
    expect(rejected.lead.status).toBe("READY_FOR_REVIEW");

    const again = await rejectLead(lead.id);
    expect(again.alreadyRejected).toBe(true);
  });
});
