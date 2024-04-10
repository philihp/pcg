import { createPcg32, nextState, prevState, randomInt, randomList } from '..'
import { OutputFnType } from '../types'

describe('basic', () => {
  it('pCG32_XSH_RR: Single integer', () => {
    expect.assertions(2)
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({}, 42, 54)
    // Check for generator immutability and result reproducibility
    const [n, _state] = randomUint32(pcg)
    expect(n).toBe(0xa15c02b7)
    expect(randomUint32(pcg)[0]).toBe(0xa15c02b7)
  })

  it('pCG32_XSH_RS: Single integer', () => {
    expect.assertions(2)
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({ outputFnType: OutputFnType.XSH_RS }, 42, 54)
    // Check for generator immutability and result reproducibility
    const [n, _state] = randomUint32(pcg)
    expect(n).toBe(1545299392)
    expect(randomUint32(pcg)[0]).toBe(1545299392)
  })

  it('pCG32_XSL_RR: Single integer', () => {
    expect.assertions(2)
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({ outputFnType: OutputFnType.XSL_RR }, 42, 54)
    // Check for generator immutability and result reproducibility
    const [n, _state] = randomUint32(pcg)
    expect(n).toBe(110043304)
    expect(randomUint32(pcg)[0]).toBe(110043304)
  })

  it('pCG32_RXS_M_XS: Single integer', () => {
    expect.assertions(2)
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({ outputFnType: OutputFnType.RXS_M_XS }, 42, 54)
    // Check for generator immutability and result reproducibility
    const [n, _state] = randomUint32(pcg)
    expect(n).toBe(3562606574)
    expect(randomUint32(pcg)[0]).toBe(3562606574)
  })

  it('pCG32_XSH_RR: Multiple integers', () => {
    expect.assertions(1)
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({}, 42, 54)
    expect(randomList(6, randomUint32, pcg).map(([value]) => value)).toStrictEqual([
      0xa15c02b7, 0x7b47f409, 0xba1d3330, 0x83d2f293, 0xbfa4784b, 0xcbed606e,
    ])
  })

  it('pCG32_XSH_RS: Multiple integers', () => {
    expect.assertions(1)
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({ outputFnType: OutputFnType.XSH_RS }, 42, 54)
    expect(randomList(6, randomUint32, pcg).map(([value]) => value)).toStrictEqual([
      1545299392, 2415717169, 3435843701, 3090997190, 1576856010, 3235194092,
    ])
  })

  it('pCG32_XSL_RR: Multiple integers', () => {
    expect.assertions(1)
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({ outputFnType: OutputFnType.XSL_RR }, 42, 54)
    expect(randomList(6, randomUint32, pcg).map(([value]) => value)).toStrictEqual([
      110043304, 3982559790, 957466950, 3645676572, 223035418, 2465086851,
    ])
  })

  it('pCG32_RXS_M_XS: Multiple integers', () => {
    expect.assertions(1)
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({ outputFnType: OutputFnType.RXS_M_XS }, 42, 54)
    expect(randomList(6, randomUint32, pcg).map(([value]) => value)).toStrictEqual([
      3562606574, 3701842622, 2826130885, 1212371962, 849807893, 1843984456,
    ])
  })

  it('pCG32_XSH_RR: Jump-ahead, jump-back', () => {
    expect.assertions(5)
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({}, 42, 54)

    expect(randomUint32(nextState(pcg))[0]).toBe(0x7b47f409)
    expect(randomUint32(prevState(nextState(pcg)))[0]).toBe(0xa15c02b7)

    expect(randomUint32(pcg)[1]).toStrictEqual(nextState(pcg))

    expect(prevState(nextState(pcg))).toStrictEqual(pcg)
    expect(nextState(prevState(pcg))).toStrictEqual(pcg)
  })

  it('can generate a number', () => {
    expect.assertions(2)
    const advancedOptions = {}
    const initState = 42
    const initStreamId = 54
    const pcg = createPcg32(advancedOptions, initState, initStreamId)

    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const [value, nextPcg] = randomUint32(pcg)

    expect(value).toBe(2707161783)
    expect(nextPcg).toBeDefined()
  })

  it('complains when range is wrong', () => {
    expect.assertions(1)
    const pcg = createPcg32({}, 42, 1)
    expect(() => randomInt(0, -1, pcg)).toThrow(RangeError)
  })

  it('can generate a list, with corresponding states', () => {
    expect.assertions(3)
    const advancedOptions = {}
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

  it('make sure there are no infinite loops', () => {
    expect.assertions(65536)
    for (let x = 0; x < 256; x++) {
      for (let y = 0; y < 256; y++) {
        const pcg = createPcg32({}, x, y)
        expect(pcg.getOutput(pcg.state)).not.toBe(0)
      }
    }
  })
})
