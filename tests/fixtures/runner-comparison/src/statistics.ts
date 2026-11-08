export function sum(values: number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

export function mean(values: number[]): number {
  return sum(values) / values.length;
}

export function minimumValue(values: number[]): number {
  let minimum = values[0] ?? 0;
  for (const value of values) {
    if (value < minimum) minimum = value;
  }
  return minimum;
}

export function maximumValue(values: number[]): number {
  let maximum = values[0] ?? 0;
  for (const value of values) {
    if (value > maximum) maximum = value;
  }
  return maximum;
}

export function variance(values: number[]): number {
  const average = mean(values);
  let squaredDifferences = 0;
  for (const value of values) squaredDifferences += (value - average) ** 2;
  return squaredDifferences / values.length;
}

export function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values));
}

export function dotProduct(left: number[], right: number[]): number {
  let total = 0;
  for (let index = 0; index < left.length; index++) {
    total += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return total;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}
