import { createPcg64, nextState64, randomInt64, randomList64 } from '..'
import { OutputFnType, StreamScheme } from '..'

describe('curried APIs', () => {
  const pcg = createPcg64({}, 42, 54)
  const directRng = randomInt64(0, 2 ** 32 - 1)
  const expected = directRng(pcg)

  it('randomInt64(min)(max)(pcg) is equivalent to randomInt64(min, max, pcg)', () => {
    expect.assertions(2)
    const partial = randomInt64(0)
    const ranger = partial(2 ** 32 - 1)
    const [value, next] = ranger(pcg)
    expect(value).toBe(expected[0])
    expect(next).toStrictEqual(expected[1])
  })

  it('randomInt64(min)(max, pcg) is equivalent to randomInt64(min, max, pcg)', () => {
    expect.assertions(2)
    const partial = randomInt64(0)
    const [value, next] = partial(2 ** 32 - 1, pcg)
    expect(value).toBe(expected[0])
    expect(next).toStrictEqual(expected[1])
  })

  it('randomList64(length)(rng)(pcg) is equivalent to randomList64(length, rng, pcg)', () => {
    expect.assertions(1)
    const expectedList = randomList64(3, directRng, pcg)
    const list = randomList64(3)<number>(directRng)(pcg)
    expect(list).toStrictEqual(expectedList)
  })

  it('randomList64(length)(rng, pcg) is equivalent to randomList64(length, rng, pcg)', () => {
    expect.assertions(1)
    const expectedList = randomList64(3, directRng, pcg)
    const list = randomList64(3)<number>(directRng, pcg)
    expect(list).toStrictEqual(expectedList)
  })

  it('randomList64(length, rng)(pcg) is equivalent to randomList64(length, rng, pcg)', () => {
    expect.assertions(1)
    const expectedList = randomList64(3, directRng, pcg)
    const list = randomList64(3, directRng)(pcg)
    expect(list).toStrictEqual(expectedList)
  })

  it('randomList64 of zero length returns an empty array', () => {
    expect.assertions(1)
    expect(randomList64(0, directRng, pcg)).toStrictEqual([])
  })

  it('exposes OutputFnType and StreamScheme from the package entry point', () => {
    expect.assertions(2)
    expect(OutputFnType.XSH_RR).toBeDefined()
    expect(StreamScheme.SETSEQ).toBeDefined()
  })

  it('throws when given an unknown variant via state mutation', () => {
    expect.assertions(1)
    const bad = { ...pcg, variant: 'unknown' as never }
    expect(() => nextState64(bad)).toThrow(/Unknown PCG variant/)
  })
})
