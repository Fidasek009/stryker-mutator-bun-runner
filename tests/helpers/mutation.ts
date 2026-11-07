import { rm } from 'node:fs/promises';
import { join } from 'node:path';

export interface MutantRecord {
  id: string;
  mutatorName: string;
  replacement: string;
  status: string;
  testsCompleted?: number;
}

export interface MutationReport {
  files: Record<string, { mutants: MutantRecord[] }>;
}

export async function runMutationFixture(
  fixtureName: string,
  configName: string,
  reportName: string
): Promise<{ durationMs: number; output: string; report: MutationReport }> {
  const fixtureDirectory = join(import.meta.dir, '../fixtures', fixtureName);
  await rm(join(fixtureDirectory, 'reports'), { recursive: true, force: true });
  const child = Bun.spawn(
    [
      process.execPath,
      '../../../node_modules/@stryker-mutator/core/bin/stryker.js',
      'run',
      configName,
    ],
    {
      cwd: fixtureDirectory,
      env: { ...process.env, __STRYKER_ACTIVE_MUTANT__: undefined },
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  const startedAt = performance.now();
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout.text(),
    child.stderr.text(),
  ]);
  const durationMs = Math.round(performance.now() - startedAt);
  const output = `${stdout}\n${stderr}`;
  if (exitCode !== 0) throw new Error(`Stryker exited with ${exitCode}:\n${output}`);
  const report = (await Bun.file(
    join(fixtureDirectory, 'reports', reportName)
  ).json()) as MutationReport;
  return { durationMs, output, report };
}

export function mutants(report: MutationReport): MutantRecord[] {
  return Object.values(report.files).flatMap(file => file.mutants);
}

export function counts(mutantResults: MutantRecord[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const mutant of mutantResults) {
    result[mutant.status] = (result[mutant.status] ?? 0) + 1;
  }
  return result;
}
