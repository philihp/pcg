import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createMulberry32, createPcg32, createSfc32, getOutput, nextState, prevState, randomInt, stepState } from '..'
import type { PCGState } from '../types'

describe('immutability of inputs', () => {
  for (const [name, make] of [
    ['pcg32', () => createPcg32({}, 42, 54)],
    ['mulberry32', () => createMulberry32(42)],
    ['sfc32', () => createSfc32(42)],
  ] as const) {
    test(`${name}: deriving states leaves the input untouched and shares nothing mutable`, () => {
      const pcg = make()
      const snapshot = JSON.stringify(pcg)
      const a = nextState(pcg)
      const b = nextState(pcg)
      const [, c] = randomInt(0, 10, pcg)
      const d = stepState(3, pcg)
      assert.deepEqual(a, b)
      assert.notEqual(a, b)
      assert.notEqual(a.state, b.state)
      assert.notEqual(a.state, pcg.state)
      assert.notEqual(c.state, pcg.state)
      assert.notEqual(d.state, pcg.state)
      // Writing into a derived state reaches neither the input nor a sibling.
      a.state.lo = 0
      a.state.hi = 0
      assert.equal(JSON.stringify(pcg), snapshot)
      assert.deepEqual(nextState(pcg), b)
    })
  }
})

describe('corrupt state tags', () => {
  const base = createPcg32({}, 42, 54)

  test('an unknown variant throws', () => {
    const bad = { ...base, variant: 'nope' } as unknown as PCGState
    assert.throws(() => nextState(bad), TypeError)
    assert.throws(() => getOutput(bad), TypeError)
  })

  test('an unknown output function throws', () => {
    const bad = { ...base, outputFnType: 7 } as unknown as PCGState
    assert.throws(() => getOutput(bad), TypeError)
  })

  test('an unknown stream scheme throws', () => {
    const bad = { ...base, streamScheme: 2 } as unknown as PCGState
    assert.throws(() => nextState(bad), TypeError)
    assert.throws(() => prevState(bad), TypeError)
    assert.throws(() => stepState(5, bad), TypeError)
  })
})
