import { expect, test } from 'bun:test';
import './runtime-sensitive';

test('keeps runtime activation isolated across test-file imports', () => {
  expect(process.env.__STRYKER_ACTIVE_MUTANT__).toBe('1');
});
