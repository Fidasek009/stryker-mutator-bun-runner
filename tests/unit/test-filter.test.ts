import { expect, test } from 'bun:test';
import { createTestNamePattern } from '../../src/bun-test-runner';

test('test filters match complete IDs and escape regular expression syntax', () => {
  const names = ['suite [one] adds (two+two)', 'money $^.* ? \\ test'];
  const pattern = new RegExp(createTestNamePattern(names));

  for (const name of names) expect(pattern.test(name)).toBe(true);
  expect(pattern.test('suite [one] adds (two+two) extra')).toBe(false);
  expect(pattern.test('suite one adds two+two')).toBe(false);
});
