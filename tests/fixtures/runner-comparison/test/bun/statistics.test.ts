import { describe, expect, test } from 'bun:test';
import * as statistics from '../../src/statistics';

type VectorOperation = (left: number[], right: number[]) => number;
type Operation = {
  name: string;
  calculate: VectorOperation;
  expected: VectorOperation;
};

const operations: Operation[] = [
  { name: 'sum', calculate: left => statistics.sum(left), expected: left => sum(left) },
  {
    name: 'mean',
    calculate: left => statistics.mean(left),
    expected: left => sum(left) / left.length,
  },
  {
    name: 'minimumValue',
    calculate: left => statistics.minimumValue(left),
    expected: left => left.reduce((minimum, value) => Math.min(minimum, value), left[0] ?? 0),
  },
  {
    name: 'maximumValue',
    calculate: left => statistics.maximumValue(left),
    expected: left => left.reduce((maximum, value) => Math.max(maximum, value), left[0] ?? 0),
  },
  {
    name: 'variance',
    calculate: left => statistics.variance(left),
    expected: left => {
      const average = sum(left) / left.length;
      return sum(left.map(value => (value - average) ** 2)) / left.length;
    },
  },
  {
    name: 'standardDeviation',
    calculate: left => statistics.standardDeviation(left),
    expected: left => {
      const average = sum(left) / left.length;
      return Math.sqrt(sum(left.map(value => (value - average) ** 2)) / left.length);
    },
  },
  {
    name: 'dotProduct',
    calculate: statistics.dotProduct,
    expected: (left, right) => sum(left.map((value, index) => value * (right[index] ?? 0))),
  },
  {
    name: 'median',
    calculate: left => statistics.median(left),
    expected: left => {
      const sorted = [...left].sort((leftValue, rightValue) => leftValue - rightValue);
      return sorted[Math.floor(sorted.length / 2)] ?? 0;
    },
  },
];

const VECTOR_LENGTH = 8192;

describe('statistics', () => {
  const vectors = Array.from({ length: 50 }, (_, vectorIndex) => ({
    left: Array.from(
      { length: VECTOR_LENGTH },
      (_, valueIndex) => (vectorIndex * 7 + valueIndex) % 101 - 50
    ),
    right: Array.from(
      { length: VECTOR_LENGTH },
      (_, valueIndex) => (vectorIndex * 11 + valueIndex * 3) % 127 - 63
    ),
  }));

  for (const { name, calculate, expected } of operations) {
    describe(name, () => {
      test.each(vectors)('vector %#', ({ left, right }) => {
        expect(calculate(left, right)).toBeCloseTo(expected(left, right), 8);
      });
    });
  }
});

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
