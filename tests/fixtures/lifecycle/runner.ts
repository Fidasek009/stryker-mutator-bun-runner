import { resolve } from 'node:path';
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
  duplicateSameFile: 'duplicate-same-file.test.ts',
  concurrent: 'concurrent.test.ts',
  each: 'each.test.ts',
  eachFilter: 'each.test.ts',
  fileFilter: 'file-filter-one.test.ts',
  beforeEach: 'before-each.test.ts',
  hitLimit: 'hit-limit.test.ts',
  glob: 'own.test.ts',
};
const testFile = mode ? files[mode] : undefined;
if (!testFile || !mode) throw new Error(`Unknown lifecycle mode: ${mode}`);
if (mode === 'glob') {
  const directory = process.env.GLOB_FIXTURE_DIRECTORY;
  if (!directory) throw new Error('GLOB_FIXTURE_DIRECTORY is required');
  process.chdir(directory);
}
const testFiles = mode === 'glob' ? ['**/*.test.ts'] : [testFile];
if (mode === 'duplicate') testFiles.push('duplicate-two.test.ts');
if (mode === 'runtime') testFiles.push('runtime-load-second.test.ts');
if (mode === 'fileFilter') testFiles.push('file-filter-two.test.ts');
const runner = new BunTestRunner(logger, {
  bun: {
    testFiles,
    timeout: 1000,
    bail: mode === 'bail',
  },
});
await runner.init();
try {
  if (['bail', 'duplicate', 'duplicateSameFile', 'concurrent', 'each', 'beforeEach', 'glob'].includes(mode)) {
    const result = await runner.dryRun({
      coverageAnalysis: mode === 'bail' || mode === 'glob' ? 'off' : 'perTest',
      timeout: 1000,
      disableBail: false,
    });
    console.log(JSON.stringify(result));
  } else {
    if (mode === 'fileFilter') {
      await runner.dryRun({ coverageAnalysis: 'off', timeout: 1000, disableBail: false });
    }
    const result = await runner.mutantRun({
      timeout: mode === 'timeout' ? 150 : 1000,
      disableBail: false,
      activeMutant: { id: '1' },
      sandboxFileName: testFile,
      mutantActivation: mode === 'fileFilter' ? 'static' : 'runtime',
      reloadEnvironment: true,
      ...(mode === 'noMatch' ? { testFilter: ['this test does not exist'] } : {}),
      ...(mode === 'eachFilter'
        ? { testFilter: ['positive check 1 => true', 'object 1 with { value: 2 }'] }
        : {}),
      ...(mode === 'fileFilter' ? { testFilter: [resolve(testFile)] } : {}),
      ...(mode === 'hitLimit' ? { hitLimit: 0 } : {}),
    });
    console.log(JSON.stringify(result));
  }
} finally {
  await runner.dispose();
}
