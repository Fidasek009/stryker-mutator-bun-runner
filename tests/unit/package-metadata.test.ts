import { expect, test } from 'bun:test';

test('package identity and Stryker compatibility match the published fork', async () => {
  const packageJson = await Bun.file(new URL('../../package.json', import.meta.url)).json();

  expect(packageJson.name).toBe('@fidasek009/stryker-mutator-bun-runner');
  expect(packageJson.author).toBe('fidasek009');
  expect(packageJson.repository.url).toBe(
    'git+https://github.com/Fidasek009/stryker-mutator-bun-runner.git'
  );
  expect(packageJson.bugs.url).toBe(
    'https://github.com/Fidasek009/stryker-mutator-bun-runner/issues'
  );
  expect(packageJson.homepage).toBe(
    'https://github.com/Fidasek009/stryker-mutator-bun-runner#readme'
  );
  expect(packageJson.packageManager).toBe('bun@1.4.4');
  expect(packageJson.dependencies['@stryker-mutator/api']).toBe('10.1.1');
  expect(packageJson.devDependencies['@stryker-mutator/core']).toBe('10.1.1');
  expect(packageJson.peerDependencies['@stryker-mutator/core']).toBe('^10.1.1');
});
