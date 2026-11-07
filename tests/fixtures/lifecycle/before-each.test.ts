import type { MutantCoverage } from '@stryker-mutator/api/core';
import { beforeEach, describe, expect, test } from 'bun:test';

interface StrykerState {
  currentTestId?: string;
  mutantCoverage?: MutantCoverage;
}

const stryker = (globalThis as typeof globalThis & { __stryker__?: StrykerState }).__stryker__;

function cover(mutantId: string): void {
  const coverage = stryker?.mutantCoverage;
  if (!coverage) throw new Error('Expected mutant coverage to be initialized');
  const currentTestId = stryker.currentTestId;
  let hits = coverage.static;
  if (currentTestId) {
    hits = coverage.perTest[currentTestId] ?? {};
    coverage.perTest[currentTestId] = hits;
  }
  hits[mutantId] = (hits[mutantId] ?? 0) + 1;
}

beforeEach(() => cover('file setup'));

describe('suite', () => {
  beforeEach(() => cover('suite setup'));

  test('first', () => {
    cover('first body');
    expect(true).toBe(true);
  });

  test('second', () => {
    cover('second body');
    expect(true).toBe(true);
  });
});

test('outside suite', () => {
  cover('outside body');
  expect(true).toBe(true);
});
