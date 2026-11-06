import { BunTestRunner } from '../../../dist/bun-test-runner.js';

const noop = () => null;
const logger = { debug: noop, info: noop, warn: noop, error: noop, fatal: noop, trace: noop };
const mode = process.argv[2];
const files: Record<string, string> = {
  empty: 'empty.test.ts',
  survive: 'pass.test.ts',
  noMatch: 'pass.test.ts',
  kill: 'fail-on-mutant.test.ts',
  runtime: 'runtime-load.test.ts',
  bail: 'bail.test.ts',
  timeout: 'slow.test.ts',
  duplicate: 'duplicate-one.test.ts',
  concurrent: 'concurrent.test.ts',
};
const testFile = mode ? files[mode] : undefined;
if (!testFile) throw new Error(`Unknown lifecycle mode: ${mode}`);
const testFiles = [testFile];
if (mode === 'duplicate') testFiles.push('duplicate-two.test.ts');
if (mode === 'runtime') testFiles.push('runtime-load-second.test.ts');
const runner = new BunTestRunner(logger, {
  bun: {
    testFiles,
    timeout: 1000,
    bail: mode === 'bail',
  },
});
await runner.init();
try {
  if (mode === 'bail' || mode === 'duplicate' || mode === 'concurrent') {
    const result = await runner.dryRun({
      coverageAnalysis: mode === 'bail' ? 'off' : 'perTest',
      timeout: 1000,
      disableBail: false,
    });
    console.log(JSON.stringify(result));
  } else {
    const result = await runner.mutantRun({
      timeout: mode === 'timeout' ? 150 : 1000,
      disableBail: false,
      activeMutant: { id: '1' },
      sandboxFileName: testFile,
      mutantActivation: 'runtime',
      reloadEnvironment: true,
      ...(mode === 'noMatch' ? { testFilter: ['this test does not exist'] } : {}),
    });
    console.log(JSON.stringify(result));
  }
} finally {
  await runner.dispose();
}
