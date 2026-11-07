import { test } from 'bun:test';
import { countHit } from './hit-counter';

test('reaches Stryker hit limit', () => {
  countHit();
});
