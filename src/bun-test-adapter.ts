import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MutantCoverage } from '@stryker-mutator/api/core';
import type { Logger } from '@stryker-mutator/api/logging';
import { TestStatus } from '@stryker-mutator/api/test-runner';
import { BunResultParser, type ParsedBunResults } from './bun-result-parser.js';
import type {
  BunRunOptions,
  BunRunResult,
  BunTestRunnerOptions,
} from './bun-test-runner-options.js';

type ProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export class BunTestAdapter {
  private readonly parser = new BunResultParser();
  private readonly processes = new Set<AbortController>();
  private readonly coverageHookPath = fileURLToPath(
    new URL(`./coverage-hook${extname(fileURLToPath(import.meta.url))}`, import.meta.url)
  );
  private readonly options: Required<Omit<BunTestRunnerOptions, 'testFiles' | 'bunArgs' | 'env'>> &
    Pick<BunTestRunnerOptions, 'testFiles' | 'bunArgs' | 'env'>;
  private defaultTestFiles?: Promise<string[]>;

  constructor(
    private readonly log: Logger,
    options: BunTestRunnerOptions
  ) {
    this.options = {
      timeout: 5000,
      bail: false,
      updateSnapshots: false,
      ...options,
    };
  }

  public async init(): Promise<void> {
    const version = process.versions.bun;
    if (!version) throw new Error('The Bun test runner must execute inside Bun');
    if (compareVersions(version, '1.4.4') < 0) {
      throw new Error(`Bun 1.4.4 or newer is required, found ${version}`);
    }
    if (this.options.timeout <= 0) {
      throw new Error('bun.timeout must be greater than zero');
    }
  }

  public async run(options: BunRunOptions): Promise<BunRunResult> {
    const temporaryRoot = join(process.cwd(), '.stryker-tmp');
    await mkdir(temporaryRoot, { recursive: true });
    const runDirectory = await mkdtemp(join(temporaryRoot, 'bun-runner-'));
    try {
      const startedAt = performance.now();
      const junitPath = join(runDirectory, 'junit.xml');
      const args = await this.buildArgs(options, junitPath);
      const env = this.buildEnvironment(options, runDirectory);
      this.log.debug(`Running ${process.execPath} ${args.join(' ')}`);
      const processResult = await this.execute(args, env, options.timeout);
      return await this.collectResult(options, runDirectory, junitPath, processResult, startedAt);
    } finally {
      await rm(runDirectory, { recursive: true, force: true });
    }
  }

  public dispose(): void {
    for (const controller of this.processes) controller.abort();
    this.processes.clear();
  }

  private async execute(args: string[], env: Record<string, string>, timeoutMs: number) {
    const controller = new AbortController();
    this.processes.add(controller);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const child = Bun.spawn([process.execPath, ...args], {
      cwd: process.cwd(),
      env,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      signal: controller.signal,
      killSignal: 'SIGKILL',
    });
    try {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        child.stdout.text(),
        child.stderr.text(),
      ]);
      return { exitCode, stdout, stderr, timedOut };
    } finally {
      clearTimeout(timeout);
      this.processes.delete(controller);
    }
  }

  private async collectResult(
    options: BunRunOptions,
    runDirectory: string,
    junitPath: string,
    processResult: ProcessResult,
    startedAt: number
  ): Promise<BunRunResult> {
    const durationMs = Math.round(performance.now() - startedAt);
    if (processResult.timedOut) return { tests: [], durationMs, timedOut: true };
    const output = [processResult.stdout, processResult.stderr].filter(Boolean).join('\n').trim();
    if (output) this.log.debug(output);
    const parsed = await this.parseResults(junitPath);
    const result: BunRunResult = {
      tests: parsed.tests,
      durationMs,
      timedOut: false,
    };
    if (options.coverageAnalysis !== 'off') {
      const mutantCoverage = await this.readCoverage(runDirectory);
      if (mutantCoverage) result.mutantCoverage = mutantCoverage;
    }
    const errorMessage = this.findExecutionError(options, processResult, output, parsed, result);
    if (errorMessage) result.errorMessage = errorMessage;
    return result;
  }

  private async parseResults(junitPath: string): Promise<ParsedBunResults> {
    const junit = Bun.file(junitPath);
    if (await junit.exists()) {
      return this.parser.parse(await junit.bytes());
    }
    return { tests: [], runtimeErrors: [] };
  }

  private findExecutionError(
    options: BunRunOptions,
    processResult: ProcessResult,
    output: string,
    parsed: ParsedBunResults,
    result: BunRunResult
  ): string | undefined {
    if (parsed.runtimeErrors.length > 0) return parsed.runtimeErrors.join('\n\n');
    const hasFailedTest = parsed.tests.some(test => test.status === TestStatus.Failed);
    if (processResult.exitCode !== 0 && !hasFailedTest) {
      return output || `Bun exited with code ${processResult.exitCode}`;
    }
    if (options.coverageAnalysis === 'perTest') {
      const duplicateTestId = this.findDuplicateTestId(parsed.tests);
      if (duplicateTestId) {
        return `Duplicate test ID with coverageAnalysis=perTest: ${duplicateTestId}`;
      }
    }
    if (options.coverageAnalysis !== 'off' && !result.mutantCoverage) {
      return 'Bun did not write mutant coverage. Check for an import error or concurrent test failure.';
    }
    return undefined;
  }

  private async buildArgs(options: BunRunOptions, junitPath: string): Promise<string[]> {
    const args = [
      'test',
      '--no-orphans',
      '--reporter=junit',
      `--reporter-outfile=${junitPath}`,
      `--timeout=${this.options.timeout}`,
    ];
    if (
      options.coverageAnalysis !== 'off' ||
      options.mutantActivation === 'runtime' ||
      options.testNamePattern !== undefined ||
      options.hitLimit !== undefined
    ) {
      args.push('--preload', this.coverageHookPath);
    }
    if (!options.disableBail && (this.options.bail || options.activeMutantId !== undefined)) {
      args.push('--bail=1');
    }
    if (this.options.updateSnapshots && options.activeMutantId === undefined) {
      args.push('--update-snapshots');
    }
    if (this.options.bunArgs) args.push(...this.options.bunArgs);
    const testFiles =
      options.testFiles === undefined
        ? await this.resolveDefaultTestFiles()
        : await this.resolveTestFiles(options.testFiles);
    args.push(...testFiles);
    return args;
  }

  private buildEnvironment(options: BunRunOptions, runDirectory: string): Record<string, string> {
    const env: Record<string, string> = { ...process.env, ...this.options.env } as Record<
      string,
      string
    >;
    delete env.__STRYKER_ACTIVE_MUTANT__;
    env.NODE_ENV = 'test';
    env.STRYKER_BUN_COVERAGE_DIRECTORY = runDirectory;
    env.STRYKER_BUN_COVERAGE_MODE = options.coverageAnalysis;
    delete env.STRYKER_BUN_RUNTIME_MUTANT_ID;
    delete env.STRYKER_BUN_TEST_NAME_PATTERN;
    if (options.testNamePattern) {
      env.STRYKER_BUN_TEST_NAME_PATTERN = options.testNamePattern;
    }
    if (options.activeMutantId !== undefined) {
      if (options.mutantActivation === 'runtime') {
        env.STRYKER_BUN_RUNTIME_MUTANT_ID = options.activeMutantId;
      } else {
        env.__STRYKER_ACTIVE_MUTANT__ = options.activeMutantId;
      }
    }
    if (options.hitLimit === undefined) {
      delete env.__STRYKER_HIT_LIMIT__;
    } else {
      env.__STRYKER_HIT_LIMIT__ = String(options.hitLimit);
    }
    return env;
  }

  private resolveDefaultTestFiles(): Promise<string[]> {
    return (this.defaultTestFiles ??= this.resolveTestFiles(this.options.testFiles));
  }

  private async resolveTestFiles(patterns?: string[]): Promise<string[]> {
    if (!patterns) return [];
    const files = new Set<string>();
    for (const pattern of patterns) {
      const isGlob = /[*?[\]{}]/.test(pattern);
      if (isGlob) {
        await this.addGlobMatches(pattern, files);
      } else {
        files.add(resolve(pattern));
      }
    }
    return [...files].sort();
  }

  private async addGlobMatches(pattern: string, files: Set<string>): Promise<void> {
    let matched = false;
    for await (const file of new Bun.Glob(pattern).scan({ cwd: process.cwd(), onlyFiles: true })) {
      if (file.split(/[/\\]/).includes('node_modules')) continue;
      files.add(file);
      matched = true;
    }
    if (!matched) throw new Error(`Test file pattern matched no files: ${pattern}`);
  }

  private findDuplicateTestId(tests: BunRunResult['tests']): string | undefined {
    const testIds = new Set<string>();
    for (const test of tests) {
      if (testIds.has(test.id)) return test.id;
      testIds.add(test.id);
    }
    return undefined;
  }

  private async readCoverage(runDirectory: string): Promise<MutantCoverage | undefined> {
    let merged: MutantCoverage | undefined;
    for await (const path of new Bun.Glob('coverage-*.json').scan({
      cwd: runDirectory,
      onlyFiles: true,
    })) {
      const coverage = (await Bun.file(join(runDirectory, path)).json()) as MutantCoverage;
      if (merged) {
        this.mergeCoverage(merged, coverage);
      } else {
        merged = coverage;
      }
    }
    return merged;
  }

  private mergeCoverage(merged: MutantCoverage, coverage: MutantCoverage): void {
    for (const [mutantId, hits] of Object.entries(coverage.static)) {
      merged.static[mutantId] = (merged.static[mutantId] ?? 0) + hits;
    }
    for (const [testId, mutants] of Object.entries(coverage.perTest)) {
      const target = (merged.perTest[testId] ??= {});
      for (const [mutantId, hits] of Object.entries(mutants)) {
        target[mutantId] = (target[mutantId] ?? 0) + hits;
      }
    }
  }
}

function compareVersions(current: string, minimum: string): number {
  const minimumParts = minimum.split('.').map(Number);
  for (const [index, currentPart] of current.split('.').map(Number).entries()) {
    const difference = currentPart - (minimumParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
