import { expect, test } from 'bun:test';

test('kills an active mutant', () => {
  expect(process.env.__STRYKER_ACTIVE_MUTANT__).toBeUndefined();
});
