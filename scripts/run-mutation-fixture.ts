import assert from 'node:assert/strict';
import { counts, mutants, runMutationFixture } from '../tests/helpers/mutation';

const moduleLoad = await runMutationFixture(
  'module-load',
  'stryker.config.json',
  'mutation-off.json'
);
assert.equal(
  mutants(moduleLoad.report).find(mutant => mutant.mutatorName === 'ObjectLiteral')?.status,
  'RuntimeError'
);
console.log(
  `module-load regression: ${formatSeconds(moduleLoad.durationMs)} (ObjectLiteral RuntimeError)`
);

const off = await runMutationFixture('benchmark', 'stryker.off.json', 'mutation-off.json');
assert.deepEqual(counts(mutants(off.report)), { Killed: 3, Survived: 3 });

const perTest = await runMutationFixture(
  'benchmark',
  'stryker.per-test.json',
  'mutation-per-test.json'
);
assert.deepEqual(counts(mutants(perTest.report)), { Killed: 3, Survived: 1, NoCoverage: 2 });
assert(!perTest.output.includes('Found test with id'));

console.log(
  JSON.stringify(
    {
      fixture: '6 mutants, 10 tests, randomized order, concurrency 2',
      coverageOffSeconds: toSeconds(off.durationMs),
      perTestSeconds: toSeconds(perTest.durationMs),
      wallTimeReductionPercent: Math.round((1 - perTest.durationMs / off.durationMs) * 100),
      outcomes: {
        off: counts(mutants(off.report)),
        perTest: counts(mutants(perTest.report)),
      },
    },
    null,
    2
  )
);

function toSeconds(durationMs: number): number {
  return Number((durationMs / 1000).toFixed(2));
}

function formatSeconds(durationMs: number): string {
  return `${toSeconds(durationMs)}s`;
}
