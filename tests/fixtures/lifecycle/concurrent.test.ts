import { expect, test } from 'bun:test';

test.concurrent('overlapping one', async () => {
  await Bun.sleep(50);
  expect(true).toBe(true);
});

test.concurrent('overlapping two', async () => {
  await Bun.sleep(50);
  expect(true).toBe(true);
});
