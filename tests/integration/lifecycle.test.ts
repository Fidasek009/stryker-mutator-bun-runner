import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TestStatus } from '@stryker-mutator/api/test-runner';
import { describe, expect, test } from 'bun:test';
import { runLifecycleFixture } from '../helpers/lifecycle';

async function expectStatus(mode: string, status: string, env: Record<string, string> = {}) {
  const result = await runLifecycleFixture(mode, env);
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
    expect(noMatch.errorMessage).toContain('executed no tests');
  });

  test('rejects ambiguous perTest IDs and concurrent perTest execution', async () => {
    const duplicate = await expectStatus('duplicate', 'error');
    const concurrentExecution = await runLifecycleFixture('concurrent');
    expect(concurrentExecution.exitCode).toBe(0);
    const concurrent = JSON.parse(concurrentExecution.stdout);

    expect(duplicate.errorMessage).toContain('Duplicate test ID with coverageAnalysis=perTest');
    expect((await expectStatus('duplicateSameFile', 'error')).errorMessage).toContain(
      'Duplicate test ID with coverageAnalysis=perTest'
    );
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
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'stryker-bun-bail-'));
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

  test('keeps expanded each test IDs identical between coverage and filtering', async () => {
    const dryRun = await expectStatus('each', 'complete');
    expect(Object.keys(dryRun.mutantCoverage.perTest).sort()).toEqual([
      'object 0 with { value: 1 }',
      'object 1 with { value: 2 }',
      'positive check 1 => true',
      'positive check 2 => false',
    ]);
    expect((await expectStatus('eachFilter', 'survived')).nrOfTests).toBe(2);
  });

  test('attributes file and suite beforeEach coverage to each test', async () => {
    const run = await expectStatus('beforeEach', 'complete');
    expect(run.mutantCoverage).toEqual({
      static: {},
      perTest: {
        'suite first': { 'file setup': 1, 'suite setup': 1, 'first body': 1 },
        'suite second': { 'file setup': 1, 'suite setup': 1, 'second body': 1 },
        'outside suite': { 'file setup': 1, 'outside body': 1 },
      },
    });
  });

  test('passes file-path filters separately from test-name filters', async () => {
    const run = await expectStatus('fileFilter', 'survived');
    expect(run.nrOfTests).toBe(1);
  });

  test('maps hit-limit exhaustion to timeout instead of a kill', async () => {
    const run = await expectStatus('hitLimit', 'timeout');
    expect(run.reason).toContain('Hit count limit reached');
  });

  test('does not collect dependency tests from test file globs', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stryker-bun-glob-'));
    try {
      await mkdir(join(directory, 'node_modules/fake'), { recursive: true });
      await Bun.write(join(directory, 'package.json'), '{"type":"module"}\n');
      await Bun.write(
        join(directory, 'own.test.ts'),
        'import { expect, test } from "bun:test"; test("from project", () => expect(true).toBe(true));\n'
      );
      await Bun.write(
        join(directory, 'node_modules/fake/dependency.test.ts'),
        'import { expect, test } from "bun:test"; test("from dependency", () => expect(true).toBe(true));\n'
      );
      const run = await expectStatus('glob', 'complete', { GLOB_FIXTURE_DIRECTORY: directory });
      expect(run.tests.map(result => result.name)).toEqual(['from project']);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('returns timeout and cleans up the subprocess', async () => {
    const startedAt = performance.now();
    const result = await expectStatus('timeout', 'timeout');

    expect(performance.now() - startedAt).toBeLessThan(2000);
    expect(result.reason).toContain('timed out');
  });
});
