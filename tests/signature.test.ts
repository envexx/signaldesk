import { describe, expect, it } from "vitest";

import { signPayload, verifySignature } from "@/lib/server/domain/signature";

describe("webhook signature", () => {
  it("verifies a raw hex digest and a sha256= prefixed digest", () => {
    const body = '{"fullName":"Web Hook"}';
    const secret = "whsec_test";
    const signature = signPayload(body, secret);

    expect(verifySignature(body, signature, secret)).toBe(true);
    expect(verifySignature(body, `sha256=${signature}`, secret)).toBe(true);
  });

  it("rejects missing, malformed, or tampered signatures", () => {
    const body = '{"fullName":"Web Hook"}';
    const secret = "whsec_test";
    const signature = signPayload(body, secret);

    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, "not-a-signature", secret)).toBe(false);
    expect(verifySignature(`${body}x`, signature, secret)).toBe(false);
    expect(verifySignature(body, signature, "different-secret")).toBe(false);
  });
});
