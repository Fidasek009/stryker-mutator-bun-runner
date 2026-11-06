import { expect, test } from 'bun:test';
import './runtime-sensitive';

test('activates a runtime mutant after imports and before test execution', () => {
  expect(process.env.__STRYKER_ACTIVE_MUTANT__).toBe('1');
  expect(globalThis.__stryker__?.activeMutant).toBe('1');
});
