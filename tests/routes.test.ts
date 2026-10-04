import { describe, expect, it } from "vitest";

import { GET as dashboardGET } from "@/app/api/dashboard/route";
import { GET as healthGET } from "@/app/api/health/route";
import { GET as leadsGET } from "@/app/api/leads/route";
import { GET as metricsGET } from "@/app/api/metrics/route";

let ip = 0;
function request(url: string): Request {
  ip += 1;
  return new Request(url, {
    headers: { "x-forwarded-for": `10.20.${ip % 250}.${(ip * 7) % 250}` },
  });
}

const endpoints: Array<[string, (request: Request) => Promise<Response>, string]> = [
  ["health", healthGET, "http://localhost/api/health"],
  ["dashboard", dashboardGET, "http://localhost/api/dashboard"],
  ["metrics", metricsGET, "http://localhost/api/metrics"],
  ["leads", leadsGET, "http://localhost/api/leads"],
];

describe("route envelopes", () => {
  it.each(endpoints)(
    "%s returns the shared success envelope",
    async (_name, handler, url) => {
      const response = await handler(request(url));
      expect(response.status).toBe(200);

      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("meta");
      expect(body).not.toHaveProperty("error");
    },
  );

  it("health reports demo mode as ok", async () => {
    const response = await healthGET(request("http://localhost/api/health"));
    const body = (await response.json()) as {
      data: { status: string; mode: string; infrastructure: unknown };
    };
    expect(body.data.status).toBe("ok");
    expect(body.data.mode).toBe("demo");
    expect(body.data.infrastructure).toBeDefined();
  });
});
