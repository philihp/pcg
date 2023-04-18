import { createPcg32, randomInt, randomList } from '..'
import { StreamScheme } from '../types'

describe('setseq', () => {
  it('generates a list', () => {
    expect.assertions(3)
    const advancedOptions = {
      streamScheme: StreamScheme.SETSEQ,
    }
    const initState = 42
    const initStreamId = 54
    const pcg = createPcg32(advancedOptions, initState, initStreamId)

    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const listLength = 6
    const out = randomList(listLength, randomUint32, pcg)

    expect(out).toHaveLength(6)
    expect(out.map((n) => n[0])).toStrictEqual([2707161783, 2068313097, 3122475824, 2211639955, 3215226955, 3421331566])

    // the next int after the 3rd state is the 4th int
    expect(randomUint32(out[2][1])[0]).toBe(out[3][0])
  })
})
