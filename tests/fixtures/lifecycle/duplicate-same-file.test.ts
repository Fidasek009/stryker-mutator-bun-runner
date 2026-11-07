import { expect, test } from 'bun:test';

test('same title', () => {
  expect('first').toBe('first');
});

test('same title', () => {
  expect('second').toBe('second');
});
