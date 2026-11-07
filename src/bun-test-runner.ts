import { isAbsolute, resolve } from 'node:path';
import type { StrykerOptions } from '@stryker-mutator/api/core';
import type { Logger } from '@stryker-mutator/api/logging';
import { commonTokens, tokens } from '@stryker-mutator/api/plugin';
import {
  DryRunStatus,
  MutantRunStatus,
  TestStatus,
  type DryRunOptions,
  type DryRunResult,
  type MutantRunOptions,
  type MutantRunResult,
  type TestRunner,
  type TestRunnerCapabilities,
  type TestResult,
} from '@stryker-mutator/api/test-runner';
import { BunTestAdapter } from './bun-test-adapter.js';
import type { BunRunOptions, BunRunResult, StrykerBunOptions } from './bun-test-runner-options.js';

const HIT_LIMIT_ERROR_MESSAGE = 'Stryker: Hit count limit reached';

export class BunTestRunner implements TestRunner {
  public static readonly inject = tokens(commonTokens.logger, commonTokens.options);
  private readonly adapter: BunTestAdapter;
  private readonly testFilesById = new Map<string, string>();

  constructor(
    private readonly log: Logger,
    options: StrykerOptions
  ) {
    this.adapter = new BunTestAdapter(log, (options as StrykerBunOptions).bun ?? {});
  }

  public capabilities(): TestRunnerCapabilities {
    return { reloadEnvironment: true };
  }

  public async init(): Promise<void> {
    await this.adapter.init();
  }

  public async dryRun(options: DryRunOptions): Promise<DryRunResult> {
    const result = await this.adapter.run({
      timeout: options.timeout,
      disableBail: options.disableBail,
      coverageAnalysis: options.coverageAnalysis,
      ...(options.testFiles ? { testFiles: options.testFiles } : {}),
    });
    if (result.timedOut) {
      return { status: DryRunStatus.Timeout, reason: 'Bun test process timed out' };
    }
    if (result.errorMessage) {
      return { status: DryRunStatus.Error, errorMessage: result.errorMessage };
    }
    this.rememberTestFiles(result.tests);
    return {
      status: DryRunStatus.Complete,
      tests: result.tests,
      ...(result.mutantCoverage ? { mutantCoverage: result.mutantCoverage } : {}),
    };
  }

  public async mutantRun(options: MutantRunOptions): Promise<MutantRunResult> {
    if (options.testFilter?.length === 0) {
      return { status: MutantRunStatus.Survived, nrOfTests: 0 };
    }

    const runOptions: BunRunOptions = {
      timeout: options.timeout,
      disableBail: options.disableBail,
      coverageAnalysis: 'off',
      activeMutantId: options.activeMutant.id,
      mutantActivation: options.mutantActivation,
      ...(options.hitLimit === undefined ? {} : { hitLimit: options.hitLimit }),
      ...this.resolveTestFilter(options.testFilter),
    };
    this.log.debug(
      `Running mutant ${options.activeMutant.id} with ${options.testFilter?.length ?? 'all'} tests`
    );
    return mapMutantRunResult(await this.adapter.run(runOptions), options.activeMutant.id);
  }

  private rememberTestFiles(tests: TestResult[]): void {
    this.testFilesById.clear();
    for (const test of tests) {
      if (test.fileName) this.testFilesById.set(test.id, resolve(test.fileName));
    }
  }

  private resolveTestFilter(
    testFilter: string[] | undefined
  ): Pick<BunRunOptions, 'testFiles' | 'testNamePattern'> {
    if (!testFilter) return {};
    const testNames: string[] = [];
    const testFiles = new Set<string>();
    for (const filter of testFilter) {
      const knownFile = this.testFilesById.get(filter);
      if (knownFile) {
        testFiles.add(knownFile);
        testNames.push(filter);
      } else if (isAbsolute(filter)) {
        testFiles.add(filter);
      } else {
        testNames.push(filter);
      }
    }
    return {
      ...(testNames.length > 0 ? { testNamePattern: createTestNamePattern(testNames) } : {}),
      ...(testFiles.size > 0 ? { testFiles: [...testFiles] } : {}),
    };
  }

  public async dispose(): Promise<void> {
    await this.adapter.dispose();
  }
}

export function createTestNamePattern(testIds: string[]): string {
  return `^(?:${testIds.map(escapeRegExp).join('|')})$`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
}

function mapMutantRunResult(result: BunRunResult, mutantId: string): MutantRunResult {
  if (result.timedOut) {
    return { status: MutantRunStatus.Timeout, reason: 'Bun test process timed out' };
  }
  if (result.errorMessage) {
    const status = result.errorMessage.includes(HIT_LIMIT_ERROR_MESSAGE)
      ? MutantRunStatus.Timeout
      : MutantRunStatus.Error;
    return status === MutantRunStatus.Timeout
      ? { status, reason: result.errorMessage }
      : { status, errorMessage: result.errorMessage };
  }

  const failedTests = result.tests.filter(test => test.status === TestStatus.Failed);
  const executedTests = result.tests.filter(test => test.status !== TestStatus.Skipped);
  const hitLimitFailure = failedTests.find(test =>
    test.failureMessage.includes(HIT_LIMIT_ERROR_MESSAGE)
  );
  if (hitLimitFailure) {
    return { status: MutantRunStatus.Timeout, reason: hitLimitFailure.failureMessage };
  }
  if (failedTests.length > 0) {
    return {
      status: MutantRunStatus.Killed,
      killedBy: failedTests.map(test => test.id),
      failureMessage: failedTests.map(test => test.failureMessage).join('\n\n'),
      nrOfTests: executedTests.length,
      duration: result.durationMs,
    };
  }
  if (executedTests.length === 0) {
    return {
      status: MutantRunStatus.Error,
      errorMessage: `Bun executed no tests for mutant ${mutantId}`,
    };
  }
  return {
    status: MutantRunStatus.Survived,
    nrOfTests: executedTests.length,
    duration: result.durationMs,
  };
}
