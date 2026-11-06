import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { TestStatus } from '@stryker-mutator/api/test-runner';
import { describe, expect, test } from 'bun:test';
import { runLifecycleFixture } from '../helpers/lifecycle';

async function expectStatus(mode: string, status: string) {
  const result = await runLifecycleFixture(mode);
  expect(result.stderr).toBe('');
  expect(result.exitCode).toBe(0);
  const run = JSON.parse(result.stdout);
  expect(run.status).toBe(status);
  return run;
}

describe('runner lifecycle', () => {
  test('returns errors for skipped and unmatched runs instead of surviving', async () => {
    const empty = await expectStatus('empty', 'error');
    const noMatch = await expectStatus('noMatch', 'error');

    expect(empty.errorMessage).toContain('executed no tests');
    expect(noMatch.errorMessage).toContain('matched 0 tests');
  });

  test('rejects ambiguous perTest IDs and concurrent perTest execution', async () => {
    const duplicate = await expectStatus('duplicate', 'error');
    const concurrentExecution = await runLifecycleFixture('concurrent');
    expect(concurrentExecution.exitCode).toBe(0);
    const concurrent = JSON.parse(concurrentExecution.stdout);

    expect(duplicate.errorMessage).toContain('Duplicate test ID across files');
    expect(concurrent.status).toBe('complete');
    expect(concurrent.tests).toHaveLength(2);
    expect(
      concurrent.tests.find(testResult => testResult.status === TestStatus.Failed)?.failureMessage
    ).toContain('Concurrent tests are unsupported');
  });

  test('distinguishes ordinary surviving and killed mutants', async () => {
    const survived = await expectStatus('survive', 'survived');
    const killed = await expectStatus('kill', 'killed');

    expect(survived.nrOfTests).toBe(1);
    expect(killed.nrOfTests).toBe(1);
    expect(killed.killedBy).toEqual(['kills an active mutant']);
  });

  test('does not activate runtime mutants while importing modules', async () => {
    const result = await expectStatus('runtime', 'survived');
    expect(result.nrOfTests).toBe(2);
  });

  test('honors bail without executing the following test', async () => {
    const temporaryDirectory = await mkdtemp('/tmp/opencode/stryker-bun-bail-');
    const marker = join(temporaryDirectory, 'after-bail');
    try {
      const result = await runLifecycleFixture('bail', { TEST_MARKER: marker });
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      const dryRun = JSON.parse(result.stdout);
      expect(dryRun.status).toBe('complete');
      expect(dryRun.tests).toHaveLength(1);
      expect(dryRun.tests[0].status).toBe(TestStatus.Failed);
      expect(await Bun.file(marker).exists()).toBe(false);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test('returns timeout and cleans up the subprocess', async () => {
    const startedAt = performance.now();
    const result = await expectStatus('timeout', 'timeout');

    expect(performance.now() - startedAt).toBeLessThan(2000);
    expect(result.reason).toContain('timed out');
  });
});
