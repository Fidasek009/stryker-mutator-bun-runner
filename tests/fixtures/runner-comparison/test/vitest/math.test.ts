import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, test } from 'vitest';
import { add, multiply } from '../../src/math';

describe('arithmetic', () => {
  test('adds zero without evidence for nonzero operands', async () => {
    await sleep(25);
    expect(add(0, 0)).toBe(0);
  });

  test('multiplies two numbers', async () => {
    await sleep(25);
    expect(multiply(2, 3)).toBe(6);
  });
});

test.each([1, 2, 3, 4, 5, 6, 7, 8])('independent case %i', async value => {
  await sleep(100);
  expect(value).toBeGreaterThan(0);
});
