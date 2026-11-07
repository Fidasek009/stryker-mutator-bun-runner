import { expect, test } from 'bun:test';

test.each([
  [1, true],
  [2, false],
])('positive check %s => %s', (value, expected) => {
  expect(value > 0).toBe(expected);
});

test.each([{ value: 1 }, { value: 2 }])('object %# with %s', ({ value }) => {
  expect(value).toBeGreaterThan(0);
});
