import { join } from 'node:path';

export async function runLifecycleFixture(
  mode: string,
  env: Record<string, string> = {}
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const fixtureDirectory = join(import.meta.dir, '../fixtures/lifecycle');
  const child = Bun.spawn([process.execPath, 'runner.ts', mode], {
    cwd: fixtureDirectory,
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout.text(),
    child.stderr.text(),
  ]);
  return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
}
