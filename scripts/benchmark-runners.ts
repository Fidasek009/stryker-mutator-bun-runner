import { rm } from 'node:fs/promises';
import { arch, platform } from 'node:os';
import { join } from 'node:path';

const fixtureDirectory = join(import.meta.dir, '../tests/fixtures/runner-comparison');
const iterations = Number(process.env.BENCHMARK_ITERATIONS ?? 10);
if (!Number.isInteger(iterations) || iterations < 1) {
  throw new Error('BENCHMARK_ITERATIONS must be a positive integer');
}

type RunnerName = 'bun' | 'command';
type RunnerConfig = {
  executable: string;
  reportPath: string;
};
type ReportSummary = {
  signature: string;
  mutationIds: string;
  testCount: number;
  mutantCount: number;
};
type RunResult = ReportSummary & {
  durationMs: number;
};

const completedMutantStatuses = new Set(['Killed', 'Survived', 'NoCoverage', 'Timeout']);
const runners: Record<RunnerName, RunnerConfig> = {
  bun: { executable: process.execPath, reportPath: join(fixtureDirectory, 'reports/bun.json') },
  command: { executable: 'node', reportPath: join(fixtureDirectory, 'reports/command.json') },
};
const samples: Record<RunnerName, number[]> = { bun: [], command: [] };
const expectedSignatures: Partial<Record<RunnerName, string>> = {};
let expectedMutationIds: string | undefined;
let testCount = 0;
let mutantCount = 0;

console.log('Warmup');
for (const name of ['bun', 'command'] as const) recordResult(name, await execute(name));
console.log(`${mutantCount} mutants, ${testCount} tests, per-test coverage, concurrency 2`);
for (let iteration = 0; iteration < iterations; iteration++) {
  const order: RunnerName[] = iteration % 2 === 0 ? ['bun', 'command'] : ['command', 'bun'];
  for (const name of order) {
    const result = await execute(name);
    recordResult(name, result);
    samples[name].push(result.durationMs);
    console.log(`${iteration + 1} ${name}: ${seconds(result.durationMs)}s`);
  }
}

const result = {
  fixture: { mutants: mutantCount, tests: testCount, coverageAnalysis: 'perTest', concurrency: 2 },
  environment: {
    platform: `${platform()} ${arch()}`,
    bun: process.versions.bun,
    node: nodeVersion(),
  },
  iterations,
  bun: summarize(samples.bun),
  command: summarize(samples.command),
  speedup: round(median(samples.command) / median(samples.bun)),
  medianTimeReductionPercent: round((1 - median(samples.bun) / median(samples.command)) * 100),
};
await Bun.write(
  join(fixtureDirectory, 'reports/comparison.json'),
  `${JSON.stringify(result, null, 2)}\n`
);
console.log(JSON.stringify(result, null, 2));

async function execute(name: RunnerName): Promise<RunResult> {
  const runner = runners[name];
  await rm(runner.reportPath, { force: true });
  const startedAt = performance.now();
  const child = Bun.spawn(
    [
      runner.executable,
      '../../../node_modules/@stryker-mutator/core/bin/stryker.js',
      'run',
      `stryker.${name}.json`,
    ],
    {
      cwd: fixtureDirectory,
      env: { ...process.env, __STRYKER_ACTIVE_MUTANT__: undefined },
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout.text(),
    child.stderr.text(),
  ]);
  if (exitCode !== 0) throw new Error(`${name} exited ${exitCode}:\n${stdout}\n${stderr}`);
  return { ...(await readSummary(runner.reportPath)), durationMs: performance.now() - startedAt };
}

function recordResult(name: RunnerName, result: RunResult): void {
  const expectedSignature = (expectedSignatures[name] ??= result.signature);
  if (result.signature !== expectedSignature) {
    throw new Error(`${name} outcomes changed: ${expectedSignature} !== ${result.signature}`);
  }
  expectedMutationIds ??= result.mutationIds;
  if (result.mutationIds !== expectedMutationIds) {
    throw new Error('Runners received different mutants');
  }
  if (name === 'bun') testCount = result.testCount;
  mutantCount = result.mutantCount;
}

async function readSummary(path: string): Promise<ReportSummary> {
  const document: unknown = await Bun.file(path).json();
  const report = record(document, 'report');
  const testFiles = record(report.testFiles, 'testFiles');
  const files = record(report.files, 'files');
  const tests: string[] = [];
  const mutants: string[] = [];
  const mutationIds: string[] = [];
  for (const file of Object.values(testFiles)) {
    const testFile = record(file, 'test file');
    for (const test of array(testFile.tests, 'tests')) {
      const testResult = record(test, 'test');
      tests.push(string(testResult.name, 'test name').replaceAll(' > ', ' '));
    }
  }
  for (const file of Object.values(files)) {
    const sourceFile = record(file, 'source file');
    for (const mutant of array(sourceFile.mutants, 'mutants')) {
      const result = record(mutant, 'mutant');
      const id = string(result.id, 'mutant id');
      const status = string(result.status, 'mutant status');
      if (!completedMutantStatuses.has(status)) {
        throw new Error(`Unexpected mutant status: ${status}`);
      }
      mutationIds.push(id);
      mutants.push(`${id}:${status}`);
    }
  }
  tests.sort();
  mutants.sort();
  mutationIds.sort();
  return {
    signature: JSON.stringify({ tests, mutants }),
    mutationIds: JSON.stringify(mutationIds),
    testCount: tests.length,
    mutantCount: mutants.length,
  };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid ${label}`);
  return value;
}

function summarize(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    samplesSeconds: values.map(seconds),
    meanSeconds: seconds(values.reduce((sum, value) => sum + value, 0) / values.length),
    medianSeconds: seconds(median(values)),
    minSeconds: seconds(sorted[0]),
    maxSeconds: seconds(sorted[sorted.length - 1]),
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  if (upper === undefined) throw new Error('Cannot calculate a median without samples');
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[middle - 1];
  if (lower === undefined) throw new Error('Cannot calculate a median without samples');
  return (lower + upper) / 2;
}

function seconds(value: number | undefined): number {
  return round((value ?? 0) / 1000);
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function nodeVersion(): string {
  const child = Bun.spawnSync(['node', '--version'], { stdout: 'pipe', stderr: 'pipe' });
  if (child.exitCode !== 0) throw new Error(child.stderr.toString());
  return child.stdout.toString().trim();
}
