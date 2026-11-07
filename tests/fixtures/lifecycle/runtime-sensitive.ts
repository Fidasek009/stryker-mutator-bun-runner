declare global {
  var __stryker__: { activeMutant?: string } | undefined;
}

if (globalThis.__stryker__?.activeMutant || process.env.__STRYKER_ACTIVE_MUTANT__) {
  throw new Error('A runtime mutant was active during module import');
}

export {};
