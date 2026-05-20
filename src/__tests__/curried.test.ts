import { createPcg32, randomInt, randomList } from '..'
import { OutputFnType, StreamScheme } from '..'

describe('curried APIs', () => {
  const pcg = createPcg32({}, 42, 54)
  const directRng = randomInt(0, 2 ** 32 - 1)
  const expected = directRng(pcg)

  it('randomInt(min)(max)(pcg) is equivalent to randomInt(min, max, pcg)', () => {
    expect.assertions(2)
    const partial = randomInt(0)
    const ranger = partial(2 ** 32 - 1)
    const [value, next] = ranger(pcg)
    expect(value).toBe(expected[0])
    expect(next).toStrictEqual(expected[1])
  })

  it('randomInt(min)(max, pcg) is equivalent to randomInt(min, max, pcg)', () => {
    expect.assertions(2)
    const partial = randomInt(0)
    const [value, next] = partial(2 ** 32 - 1, pcg)
    expect(value).toBe(expected[0])
    expect(next).toStrictEqual(expected[1])
  })

  it('randomList(length)(rng)(pcg) is equivalent to randomList(length, rng, pcg)', () => {
    expect.assertions(1)
    const expectedList = randomList(3, directRng, pcg)
    const list = randomList(3)<number>(directRng)(pcg)
    expect(list).toStrictEqual(expectedList)
  })

  it('randomList(length)(rng, pcg) is equivalent to randomList(length, rng, pcg)', () => {
    expect.assertions(1)
    const expectedList = randomList(3, directRng, pcg)
    const list = randomList(3)<number>(directRng, pcg)
    expect(list).toStrictEqual(expectedList)
  })

  it('randomList(length, rng)(pcg) is equivalent to randomList(length, rng, pcg)', () => {
    expect.assertions(1)
    const expectedList = randomList(3, directRng, pcg)
    const list = randomList(3, directRng)(pcg)
    expect(list).toStrictEqual(expectedList)
  })

  it('randomList of zero length returns an empty array', () => {
    expect.assertions(1)
    expect(randomList(0, directRng, pcg)).toStrictEqual([])
  })

  it('exposes OutputFnType and StreamScheme from the package entry point', () => {
    expect.assertions(2)
    expect(OutputFnType.XSH_RR).toBeDefined()
    expect(StreamScheme.SETSEQ).toBeDefined()
  })

})
