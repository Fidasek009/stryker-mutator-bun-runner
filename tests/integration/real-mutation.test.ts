import { expect, test } from 'bun:test';
import { counts, mutants, runMutationFixture } from '../helpers/mutation';

function byReplacement(results: ReturnType<typeof mutants>): Map<string, (typeof results)[number]> {
  return new Map(results.map(mutant => [mutant.replacement, mutant]));
}

test('module-load crashes become runtime errors, never false survivors', async () => {
  const { report } = await runMutationFixture(
    'module-load',
    'stryker.config.json',
    'mutation-off.json'
  );
  const results = mutants(report);

  expect(results.find(mutant => mutant.mutatorName === 'ObjectLiteral')?.status).toBe(
    'RuntimeError'
  );
  expect(counts(results)).toEqual({ Killed: 2, Survived: 3, RuntimeError: 3 });
}, 30_000);

test('perTest collects real coverage and runs only relevant randomized tests', async () => {
  const { report, output } = await runMutationFixture(
    'benchmark',
    'stryker.per-test.json',
    'mutation-per-test.json'
  );
  const allResults = mutants(report);
  const results = byReplacement(allResults);

  expect(results.get('left - right')?.status).toBe('Survived');
  expect(results.get('left - right')?.testsCompleted).toBe(1);
  expect(results.get('left / right')?.status).toBe('Killed');
  expect(results.get('+value')?.status).toBe('NoCoverage');
  expect(results.get('+value')?.testsCompleted ?? 0).toBe(0);
  expect(output).not.toContain('Found test with id');
  expect(counts(allResults)).toEqual({ Killed: 3, Survived: 1, NoCoverage: 2 });
}, 30_000);

test('coverage off preserves ordinary killed and surviving outcomes', async () => {
  const { report } = await runMutationFixture('benchmark', 'stryker.off.json', 'mutation-off.json');
  const allResults = mutants(report);
  const results = byReplacement(allResults);

  expect(results.get('left - right')?.status).toBe('Survived');
  expect(results.get('left - right')?.testsCompleted).toBe(10);
  expect(results.get('+value')?.status).toBe('Survived');
  expect(results.get('+value')?.testsCompleted).toBe(10);
  expect(counts(allResults)).toEqual({ Killed: 3, Survived: 3 });
}, 30_000);
