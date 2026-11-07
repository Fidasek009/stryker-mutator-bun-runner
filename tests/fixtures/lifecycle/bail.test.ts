import { writeFileSync } from 'node:fs';
import { expect, test } from 'bun:test';

test('fails first', () => {
  expect('actual').toBe('expected');
});

test('must not run after bail', () => {
  const marker = process.env.TEST_MARKER;
  if (!marker) throw new Error('TEST_MARKER is required');
  writeFileSync(marker, 'executed');
});
