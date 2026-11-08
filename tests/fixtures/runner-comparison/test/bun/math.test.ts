import { describe, expect, test } from 'bun:test';
import * as math from '../../src/math';

type BinaryOperation = (left: number, right: number) => number;
type Operation = {
  name: string;
  calculate: BinaryOperation;
  expected: BinaryOperation;
};

const operations: Operation[] = [
  { name: 'add', calculate: math.add, expected: (left, right) => left + right },
  { name: 'subtract', calculate: math.subtract, expected: (left, right) => left - right },
  { name: 'multiply', calculate: math.multiply, expected: (left, right) => left * right },
  { name: 'divide', calculate: math.divide, expected: (left, right) => left / right },
  { name: 'remainder', calculate: math.remainder, expected: (left, right) => left % right },
  { name: 'minimum', calculate: math.minimum, expected: Math.min },
  { name: 'maximum', calculate: math.maximum, expected: Math.max },
  { name: 'average', calculate: math.average, expected: (left, right) => (left + right) / 2 },
  {
    name: 'hypotenuse',
    calculate: math.hypotenuse,
    expected: (left, right) => Math.sqrt(left * left + right * right),
  },
  {
    name: 'weightedLeft',
    calculate: math.weightedLeft,
    expected: (left, right) => left * 0.75 + right * 0.25,
  },
  {
    name: 'weightedRight',
    calculate: math.weightedRight,
    expected: (left, right) => left * 0.25 + right * 0.75,
  },
  { name: 'distance', calculate: math.distance, expected: (left, right) => Math.abs(left - right) },
  {
    name: 'squaredDistance',
    calculate: math.squaredDistance,
    expected: (left, right) => left * left + right * right,
  },
];

describe('calculations', () => {
  for (const { name, calculate, expected } of operations) {
    describe(name, () => {
      const cases = Array.from({ length: 50 }, (_, index) => ({
        left: index - 25,
        right: (index % 7) - 3 || 1,
      }));
      test.each(cases)('$left and $right', ({ left, right }) => {
        expect(calculate(left, right)).toBeCloseTo(expected(left, right), 10);
      });
    });
  }
});
