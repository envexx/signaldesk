import { describe, expect, it, vi } from "vitest";

import {
  jsonError,
  jsonOk,
  toErrorResponse,
} from "@/lib/server/domain/api-response";
import { NotFoundError } from "@/lib/server/domain/errors";

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("response envelope", () => {
  it("wraps success as { data, meta }", async () => {
    const response = jsonOk({ hello: "world" }, { total: 1 });
    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { hello: "world" }, meta: { total: 1 } });
  });

  it("wraps errors as { error: { code, message } }", async () => {
    const response = jsonError({ code: "NOT_FOUND", message: "Lead not found" }, 404);
    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: { code: "NOT_FOUND", message: "Lead not found" },
    });
  });

  it("maps known AppError instances to safe responses", async () => {
    const response = toErrorResponse(new NotFoundError());
    const body = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("never leaks stack traces on unknown errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = toErrorResponse(new Error("boom: secret db url"));
      const body = (await response.json()) as {
        error: { code: string; message: string };
      };
      expect(response.status).toBe(500);
      expect(body.error.code).toBe("INTERNAL_ERROR");
      expect(body.error.message).not.toContain("secret db url");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("timestamp contract", () => {
  it("uses ISO strings for all lead timestamps", async () => {
    const { createLead } = await import(
      "@/lib/server/services/lead-service"
    );
    const lead = await createLead(
      {
        fullName: "ISO Candidate",
        workEmail: "iso@timestamp-widgets.com",
        companyWebsite: "timestamp-widgets.com",
      },
      { source: "test" },
    );

    expect(lead.createdAt).toMatch(ISO);
    expect(lead.updatedAt).toMatch(ISO);
    expect(lead.lastActivityAt).toMatch(ISO);
  });
});
