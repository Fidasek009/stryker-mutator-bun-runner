import { expect, test } from 'bun:test';
import { initialState } from '../src/state';

test('initial state is empty', () => {
  expect(initialState).toEqual({ items: [] });
});
