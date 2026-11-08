export function add(left: number, right: number): number {
  return left + right;
}

export function subtract(left: number, right: number): number {
  return left - right;
}

export function multiply(left: number, right: number): number {
  return left * right;
}

export function divide(left: number, right: number): number {
  return left / right;
}

export function remainder(left: number, right: number): number {
  return left % right;
}

export function minimum(left: number, right: number): number {
  return Math.min(left, right);
}

export function maximum(left: number, right: number): number {
  return Math.max(left, right);
}

export function average(left: number, right: number): number {
  return (left + right) / 2;
}

export function hypotenuse(left: number, right: number): number {
  return Math.sqrt(left * left + right * right);
}

export function weightedLeft(left: number, right: number): number {
  return left * 0.75 + right * 0.25;
}

export function weightedRight(left: number, right: number): number {
  return left * 0.25 + right * 0.75;
}

export function distance(left: number, right: number): number {
  return Math.abs(left - right);
}

export function squaredDistance(left: number, right: number): number {
  return left * left + right * right;
}
