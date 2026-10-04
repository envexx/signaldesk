import "server-only";

import { getKvStore } from "./kv";

const TTL_SECONDS = 60 * 60 * 24 * 7;

function key(idempotencyKey: string): string {
  return `idempotency:webhook:${idempotencyKey}`;
}

/** Remember which lead a webhook idempotency key produced (cross-instance). */
export async function rememberIdempotency(
  idempotencyKey: string,
  leadId: string,
): Promise<void> {
  await getKvStore().set(key(idempotencyKey), leadId, TTL_SECONDS);
}

export async function lookupIdempotency(
  idempotencyKey: string,
): Promise<string | null> {
  return getKvStore().get(key(idempotencyKey));
}
