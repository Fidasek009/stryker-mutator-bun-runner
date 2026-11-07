import type { CoverageAnalysis, MutantCoverage, StrykerOptions } from '@stryker-mutator/api/core';
import type { TestResult } from '@stryker-mutator/api/test-runner';

export interface BunTestRunnerOptions {
  /** Test files or glob patterns. Bun's default discovery is used when omitted. */
  testFiles?: string[];
  /** Bun's timeout for each test in milliseconds. */
  timeout?: number;
  /** Stop the dry run after the first failure. Mutant runs bail unless Stryker disables bail. */
  bail?: boolean;
  /** Additional arguments for `bun test`. */
  bunArgs?: string[];
  /** Environment overrides for each Bun process. */
  env?: Record<string, string>;
  /** Allow Bun to update snapshots during dry runs, never during mutant runs. */
  updateSnapshots?: boolean;
}

export interface StrykerBunOptions extends StrykerOptions {
  bun?: BunTestRunnerOptions;
}

export interface BunRunOptions {
  timeout: number;
  disableBail: boolean;
  coverageAnalysis: CoverageAnalysis;
  testFiles?: string[];
  testNamePattern?: string;
  activeMutantId?: string;
  mutantActivation?: 'runtime' | 'static';
  hitLimit?: number;
}

export interface BunRunResult {
  tests: TestResult[];
  mutantCoverage?: MutantCoverage;
  durationMs: number;
  timedOut: boolean;
  errorMessage?: string;
}
