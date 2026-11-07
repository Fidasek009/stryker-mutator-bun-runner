import { test } from 'bun:test';

test.skip('not executed', () => {
  throw new Error('skipped tests must not execute');
});
