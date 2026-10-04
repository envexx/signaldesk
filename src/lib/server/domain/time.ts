import "server-only";

/** All timestamps crossing module boundaries are ISO strings. */
export function isoNow(): string {
  return new Date().toISOString();
}

export function toIso(value: Date): string {
  return value.toISOString();
}

export function addMs(iso: string, deltaMs: number): string {
  return new Date(new Date(iso).getTime() + deltaMs).toISOString();
}

export function diffMs(fromIso: string, toIsoValue: string): number {
  return Math.max(
    0,
    new Date(toIsoValue).getTime() - new Date(fromIso).getTime(),
  );
}

export function minutesAgoIso(reference: Date, minutes: number): string {
  return new Date(reference.getTime() - minutes * 60_000).toISOString();
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}
