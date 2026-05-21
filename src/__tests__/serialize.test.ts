import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createPcg32, nextState, randomInt, randomList } from '..'
import { OutputFnType, PCGState, StreamScheme } from '../types'

describe('serialize', () => {
  test('round-trips the state through JSON.stringify/parse', () => {
    const pcg = createPcg32({}, 42, 54)
    const json = JSON.stringify(pcg)
    const revived = JSON.parse(json) as PCGState
    assert.deepEqual(revived, pcg)

    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    assert.equal(randomUint32(revived)[0], randomUint32(pcg)[0])
  })

  test('continues a generation sequence after a serialization round-trip', () => {
    const pcg = createPcg32({}, 42, 54)
    const randomUint32 = randomInt(0, 2 ** 32 - 1)

    const reference = randomList(6, randomUint32, pcg).map(([v]) => v)

    // Generate the first 3, persist the state, then continue.
    const firstThree = randomList(3, randomUint32, pcg)
    const persisted = JSON.parse(JSON.stringify(firstThree[2][1])) as PCGState
    const resumed = randomList(3, randomUint32, persisted).map(([v]) => v)

    assert.deepEqual([...firstThree.map(([v]) => v), ...resumed], reference)
  })

  test('state contains no functions and no bigints', () => {
    const pcg = createPcg32({}, 42, 54)
    const seen = new Set<unknown>()
    const walk = (value: unknown): void => {
      if (value === null || typeof value !== 'object') {
        if (typeof value === 'function') throw new Error('state contains a function')
        if (typeof value === 'bigint') throw new Error('state contains a bigint')
        return
      }
      if (seen.has(value)) return
      seen.add(value)
      for (const v of Object.values(value as Record<string, unknown>)) walk(v)
    }
    assert.doesNotThrow(() => walk(pcg))
  })

  test('survives serialization with non-default scheme and output function', () => {
    const pcg = createPcg32({ streamScheme: StreamScheme.ONESEQ, outputFnType: OutputFnType.RXS_M_XS }, 42, 54)
    const revived = JSON.parse(JSON.stringify(pcg)) as PCGState
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    assert.deepEqual(
      randomList(4, randomUint32, revived).map(([v]) => v),
      randomList(4, randomUint32, pcg).map(([v]) => v)
    )
  })

  test('preserves state after multiple nextState calls across a round-trip', () => {
    const pcg = createPcg32({}, 42, 54)
    let live = pcg
    let revived: PCGState = JSON.parse(JSON.stringify(pcg))
    for (let i = 0; i < 100; i++) {
      live = nextState(live)
      revived = nextState(JSON.parse(JSON.stringify(revived)))
    }
    assert.deepEqual(revived, live)
  })
})
