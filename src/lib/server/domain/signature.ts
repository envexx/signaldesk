import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA256 signature (hex) for a raw webhook body. */
export function signPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/**
 * Constant-time verification of the `X-SignalDesk-Signature` header. Accepts
 * either a raw hex digest or a `sha256=<hex>` value.
 */
export function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;

  const provided = signature.trim().toLowerCase().replace(/^sha256=/, "");
  const expected = signPayload(rawBody, secret);

  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
