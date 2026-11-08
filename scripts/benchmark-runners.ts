import { rm } from 'node:fs/promises';
import { arch, cpus, platform } from 'node:os';
import { join } from 'node:path';

const fixtureDirectory = join(import.meta.dir, '../tests/fixtures/runner-comparison');
const iterations = Number(process.env.BENCHMARK_ITERATIONS ?? 10);
if (!Number.isInteger(iterations) || iterations < 1) {
  throw new Error('BENCHMARK_ITERATIONS must be a positive integer');
}

type RunnerName = 'bun' | 'vitest';
type RunnerConfig = {
  executable: string;
  reportPath: string;
};
type ReportSummary = {
  signature: string;
  testCount: number;
  mutantCount: number;
};
type RunResult = ReportSummary & {
  durationMs: number;
};

const runners: Record<RunnerName, RunnerConfig> = {
  bun: { executable: process.execPath, reportPath: join(fixtureDirectory, 'reports/bun.json') },
  vitest: { executable: 'node', reportPath: join(fixtureDirectory, 'reports/vitest.json') },
};
const samples: Record<RunnerName, number[]> = { bun: [], vitest: [] };
let expectedSignature: string | undefined;
let testCount = 0;
let mutantCount = 0;

console.log(`Warmup: 6 mutants, 10 tests, per-test coverage, concurrency 2`);
for (const name of ['bun', 'vitest'] as const) recordResult(await execute(name));
for (let iteration = 0; iteration < iterations; iteration++) {
  const order: RunnerName[] = iteration % 2 === 0 ? ['bun', 'vitest'] : ['vitest', 'bun'];
  for (const name of order) {
    const result = await execute(name);
    recordResult(result);
    samples[name].push(result.durationMs);
    console.log(`${iteration + 1} ${name}: ${seconds(result.durationMs)}s`);
  }
}

const result = {
  fixture: { mutants: mutantCount, tests: testCount, coverageAnalysis: 'perTest', concurrency: 2 },
  environment: {
    platform: `${platform()} ${arch()}`,
    cpu: cpus()[0]?.model ?? 'unknown',
    bun: process.versions.bun,
    node: nodeVersion(),
  },
  iterations,
  bun: summarize(samples.bun),
  vitest: summarize(samples.vitest),
  speedup: round(median(samples.vitest) / median(samples.bun)),
  medianTimeReductionPercent: round((1 - median(samples.bun) / median(samples.vitest)) * 100),
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

function recordResult(result: RunResult): void {
  expectedSignature ??= result.signature;
  if (result.signature !== expectedSignature) {
    throw new Error(`Runner outcomes differ: ${expectedSignature} !== ${result.signature}`);
  }
  testCount = result.testCount;
  mutantCount = result.mutantCount;
}

async function readSummary(path: string): Promise<ReportSummary> {
  const document: unknown = await Bun.file(path).json();
  const report = record(document, 'report');
  const testFiles = record(report.testFiles, 'testFiles');
  const files = record(report.files, 'files');
  const tests: string[] = [];
  const mutants: string[] = [];
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
      mutants.push(`${string(result.id, 'mutant id')}:${string(result.status, 'mutant status')}`);
    }
  }
  tests.sort();
  mutants.sort();
  return {
    signature: JSON.stringify({ tests, mutants }),
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
