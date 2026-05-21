// Ambient declarations for the jest-shaped globals used in our test files.
// Backed at runtime by node:test plus the shim in test-setup.mjs.

declare global {
  type TestFn = () => void | Promise<void>

  function describe(name: string, fn: () => void): void
  interface ItFn {
    (name: string, fn: TestFn): void
    each<T extends readonly unknown[]>(
      rows: readonly T[]
    ): (name: string, fn: (...args: T) => void | Promise<void>) => void
  }
  const it: ItFn

  interface Matchers {
    toBe(expected: unknown): void
    toEqual(expected: unknown): void
    toStrictEqual(expected: unknown): void
    toBeTruthy(): void
    toBeDefined(): void
    toBeGreaterThan(n: number): void
    toBeGreaterThanOrEqual(n: number): void
    toBeLessThan(n: number): void
    toBeLessThanOrEqual(n: number): void
    toHaveLength(n: number): void
    toThrow(matcher?: unknown): void
    not: Matchers
  }
  interface ExpectFn {
    (received: unknown): Matchers
    assertions(n: number): void
    hasAssertions(): void
  }
  const expect: ExpectFn
}

export {}
