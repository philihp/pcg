import { createPcg32, randomInt, randomList } from '..'
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
    expect(out.map((n) => n[0])).toStrictEqual([3940826535, 1033475631, 873744767, 3182467198, 835869905, 3276614663])

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
})
