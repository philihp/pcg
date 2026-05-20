import { createPcg32, nextState, randomInt, randomList, stepState } from '..'
import { StreamScheme } from '../types'

describe('sfc32', () => {
  it('generates a list', () => {
    expect.assertions(3)
    const advancedOptions = {
      streamScheme: StreamScheme.SFC32,
    }
    const initState = 42
    const initStreamId = 54
    const pcg = createPcg32(advancedOptions, initState, initStreamId)

    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const listLength = 6
    const out = randomList(listLength, randomUint32, pcg)

    expect(out).toHaveLength(6)
    expect(out.map((n) => n[0])).toStrictEqual([3035864203, 3046886407, 2809154280, 3978744183, 2349038568, 2248914523])

    // the next int after the 3rd state is the 4th int
    expect(randomUint32(out[2][1])[0]).toBe(out[3][0])
  })

  it('produces a different stream than MULBERRY32 for the same seed', () => {
    expect.assertions(1)
    const a = createPcg32({ streamScheme: StreamScheme.SFC32 }, 42, 54)
    const b = createPcg32({ streamScheme: StreamScheme.MULBERRY32 }, 42, 54)
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    expect(randomUint32(a)[0]).not.toBe(randomUint32(b)[0])
  })

  it('keeps state JSON-serializable (no bigint)', () => {
    expect.assertions(0)
    const pcg = createPcg32({ streamScheme: StreamScheme.SFC32 }, 42, 54)
    const walk = (value: unknown): void => {
      if (value === null || typeof value !== 'object') {
        if (typeof value === 'bigint') throw new Error('state contains a bigint')
        return
      }
      for (const v of Object.values(value as Record<string, unknown>)) walk(v)
    }
    walk(pcg)
  })

  it('supports forward stepState by brute force, rejects negative deltas', () => {
    expect.assertions(2)
    const pcg = createPcg32({ streamScheme: StreamScheme.SFC32 }, 42, 54)
    let manual = pcg
    for (let i = 0; i < 5; i++) manual = nextState(manual)
    expect(stepState(5, pcg)).toStrictEqual(manual)
    expect(() => stepState(-1, pcg)).toThrow(RangeError)
  })
})
