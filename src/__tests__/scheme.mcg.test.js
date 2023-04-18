import { createPcg32, randomInt, randomList } from '..'
import { MCG } from '../enums/StreamScheme'

describe('mcg', () => {
  it('generates a list', () => {
    expect.assertions(3)
    const advancedOptions = {
      streamScheme: MCG,
    }
    const initState = 42
    const initStreamId = 54
    const pcg = createPcg32(advancedOptions, initState, initStreamId)

    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const listLength = 6
    const out = randomList(listLength, randomUint32, pcg)

    expect(out).toHaveLength(6)
    expect(out.map((n) => n[0])).toStrictEqual([2707161783, 481379097, 3013076618, 44264614, 123970576, 1499079222])

    // the next int after the 3rd state is the 4th int
    expect(randomUint32(out[2][1])[0]).toBe(out[3][0])
  })
})
