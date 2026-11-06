import { test } from 'bun:test';

test('exceeds the runner-level timeout', async () => {
  await Bun.sleep(10_000);
});
