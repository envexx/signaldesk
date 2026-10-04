import "server-only";

/**
 * Deterministic pseudo-random helpers. Every demo provider derives its output
 * from the lead identity so the same input always yields the same result —
 * required for stable portfolio screenshots.
 */

export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function intBetween(seed: string, min: number, max: number): number {
  if (max <= min) return min;
  const span = max - min + 1;
  return min + (hashString(seed) % span);
}

export function pick<T>(items: readonly T[], seed: string): T {
  return items[hashString(seed) % items.length];
}

export function shuffled<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = hashString(`${seed}:${i}`) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function pickMany<T>(
  items: readonly T[],
  seed: string,
  count: number,
): T[] {
  return shuffled(items, seed).slice(0, Math.max(0, Math.min(count, items.length)));
}
