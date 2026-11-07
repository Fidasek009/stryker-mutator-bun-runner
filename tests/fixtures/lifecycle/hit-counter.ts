declare global {
  var __stryker__:
    | {
        hitCount?: number;
        hitLimit?: number;
      }
    | undefined;
}

export function countHit(): void {
  const stryker = globalThis.__stryker__;
  if (!stryker) return;
  stryker.hitCount = (stryker.hitCount ?? 0) + 1;
  if (stryker.hitLimit !== undefined && stryker.hitCount > stryker.hitLimit) {
    throw new Error(`Stryker: Hit count limit reached (${stryker.hitCount})`);
  }
}
