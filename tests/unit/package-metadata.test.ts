import { expect, test } from 'bun:test';

test('package identity and Stryker compatibility match the published fork', async () => {
  const packageJson = await Bun.file(new URL('../../package.json', import.meta.url)).json();

  expect(packageJson.name).toBe('stryker-mutator-bun-runner');
  expect(packageJson.packageManager).toBe('bun@1.4.4');
  expect(packageJson.dependencies['@stryker-mutator/api']).toBe('10.1.1');
  expect(packageJson.dependencies['@stryker-mutator/util']).toBe('10.1.1');
  expect(packageJson.devDependencies['@stryker-mutator/core']).toBe('10.1.1');
  expect(packageJson.peerDependencies['@stryker-mutator/core']).toBe('^10.1.1');
});
