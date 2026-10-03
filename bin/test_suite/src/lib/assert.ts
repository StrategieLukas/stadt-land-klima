export class TestFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestFailure';
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new TestFailure(message);
}

export function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new TestFailure(`${message}. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

export function assertIncludes(haystack: string, needle: string, message: string): void {
  if (!haystack.includes(needle)) {
    throw new TestFailure(`${message}. Missing text: ${needle}`);
  }
}

export function assertNotIncludes(haystack: string, needle: string, message: string): void {
  if (haystack.includes(needle)) {
    throw new TestFailure(`${message}. Unexpected text: ${needle}`);
  }
}

export function assertNear(actual: number, expected: number, tolerance: number, message: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new TestFailure(`${message}. Expected ${expected} +/- ${tolerance}, got ${actual}.`);
  }
}
