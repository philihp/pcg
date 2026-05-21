// Minimal jest-compatibility shim layered on top of node:test + node:assert.
// Provides the `expect` global and patches `it.each` so the existing test
// files can run unchanged under `node --test`.

import assert from 'node:assert/strict'
import { describe, it, test, before, after, beforeEach, afterEach } from 'node:test'

globalThis.describe = describe
globalThis.it = it
globalThis.test = test
globalThis.before = before
globalThis.after = after
globalThis.beforeEach = beforeEach
globalThis.afterEach = afterEach

const makeMatchers = (received, negated) => {
  const eq = negated ? assert.notStrictEqual : assert.strictEqual
  const deq = negated ? assert.notDeepStrictEqual : assert.deepStrictEqual
  const ok = (cond, msg) => {
    if (negated ? cond : !cond)
      throw new assert.AssertionError({ message: msg, actual: received })
  }
  const m = {
    toBe: (e) => eq(received, e),
    toEqual: (e) => deq(received, e),
    toStrictEqual: (e) => deq(received, e),
    toBeTruthy: () => ok(Boolean(received), `expected truthy, got ${String(received)}`),
    toBeDefined: () => ok(received !== undefined, 'expected defined'),
    toBeGreaterThan: (n) => ok(received > n, `expected ${received} > ${n}`),
    toBeGreaterThanOrEqual: (n) => ok(received >= n, `expected ${received} >= ${n}`),
    toBeLessThan: (n) => ok(received < n, `expected ${received} < ${n}`),
    toBeLessThanOrEqual: (n) => ok(received <= n, `expected ${received} <= ${n}`),
    toHaveLength: (n) => eq(received.length, n),
    toThrow: (matcher) => {
      if (negated) {
        assert.doesNotThrow(received)
      } else if (matcher === undefined) {
        assert.throws(received)
      } else {
        assert.throws(received, matcher)
      }
    },
  }
  if (!negated) m.not = makeMatchers(received, true)
  return m
}

const expect = (received) => makeMatchers(received, false)
expect.assertions = () => {}
expect.hasAssertions = () => {}

globalThis.expect = expect

const eachImpl = (rows) => (name, fn) => {
  for (const row of rows) {
    const args = Array.isArray(row) ? row : [row]
    let i = 0
    const interpolated = name.replace(/%[sdif%]/g, (tok) =>
      tok === '%%' ? '%' : String(args[i++])
    )
    it(interpolated, () => fn(...args))
  }
}

it.each = eachImpl
if (globalThis.it && globalThis.it !== it) globalThis.it.each = eachImpl
