import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createPcg32, getOutput, nextState, prevState, randomInt, randomList } from '..'
import { OutputFnType } from '../types'

describe('basic', () => {
  test('pCG32_XSH_RR: Single integer', () => {
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({}, 42, 54)
    // Check for generator immutability and result reproducibility
    const [n] = randomUint32(pcg)
    assert.equal(n, 0xa15c02b7)
    assert.equal(randomUint32(pcg)[0], 0xa15c02b7)
  })

  test('pCG32_XSH_RS: Single integer', () => {
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({ outputFnType: OutputFnType.XSH_RS }, 42, 54)
    const [n] = randomUint32(pcg)
    assert.equal(n, 1545299392)
    assert.equal(randomUint32(pcg)[0], 1545299392)
  })

  test('pCG32_XSL_RR: Single integer', () => {
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({ outputFnType: OutputFnType.XSL_RR }, 42, 54)
    const [n] = randomUint32(pcg)
    assert.equal(n, 110043304)
    assert.equal(randomUint32(pcg)[0], 110043304)
  })

  test('pCG32_RXS_M_XS: Single integer', () => {
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({ outputFnType: OutputFnType.RXS_M_XS }, 42, 54)
    const [n] = randomUint32(pcg)
    assert.equal(n, 3562606574)
    assert.equal(randomUint32(pcg)[0], 3562606574)
  })

  test('pCG32_XSH_RR: Multiple integers', () => {
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({}, 42, 54)
    assert.deepEqual(
      randomList(6, randomUint32, pcg).map(([value]) => value),
      [0xa15c02b7, 0x7b47f409, 0xba1d3330, 0x83d2f293, 0xbfa4784b, 0xcbed606e]
    )
  })

  test('pCG32_XSH_RS: Multiple integers', () => {
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({ outputFnType: OutputFnType.XSH_RS }, 42, 54)
    assert.deepEqual(
      randomList(6, randomUint32, pcg).map(([value]) => value),
      [1545299392, 2415717169, 3435843701, 3090997190, 1576856010, 3235194092]
    )
  })

  test('pCG32_XSL_RR: Multiple integers', () => {
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({ outputFnType: OutputFnType.XSL_RR }, 42, 54)
    assert.deepEqual(
      randomList(6, randomUint32, pcg).map(([value]) => value),
      [110043304, 3982559790, 957466950, 3645676572, 223035418, 2465086851]
    )
  })

  test('pCG32_RXS_M_XS: Multiple integers', () => {
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({ outputFnType: OutputFnType.RXS_M_XS }, 42, 54)
    assert.deepEqual(
      randomList(6, randomUint32, pcg).map(([value]) => value),
      [3562606574, 3701842622, 2826130885, 1212371962, 849807893, 1843984456]
    )
  })

  test('pCG32_XSH_RR: Jump-ahead, jump-back', () => {
    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const pcg = createPcg32({}, 42, 54)

    assert.equal(randomUint32(nextState(pcg))[0], 0x7b47f409)
    assert.equal(randomUint32(prevState(nextState(pcg)))[0], 0xa15c02b7)

    assert.deepEqual(randomUint32(pcg)[1], nextState(pcg))

    assert.deepEqual(prevState(nextState(pcg)), pcg)
    assert.deepEqual(nextState(prevState(pcg)), pcg)
  })

  test('can generate a number', () => {
    const pcg = createPcg32({}, 42, 54)

    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const [value, nextPcg] = randomUint32(pcg)

    assert.equal(value, 2707161783)
    assert.notEqual(nextPcg, undefined)
  })

  test('complains when range is wrong', () => {
    const pcg = createPcg32({}, 42, 1)
    assert.throws(() => randomInt(0, -1, pcg), RangeError)
  })

  test('supports the full 32-bit output range (bound === 2^32)', () => {
    const pcg = createPcg32({}, 42, 54)
    const randomFullUint32 = randomInt(0, 2 ** 32)
    // With bound === outputMaxRange, threshold is 0 and the raw output is
    // returned unmodified, so this should match the first raw XSH_RR output.
    assert.equal(randomFullUint32(pcg)[0], 0xa15c02b7)
    assert.throws(() => randomInt(0, 2 ** 32 + 1, pcg), RangeError)
  })

  test('can generate a list, with corresponding states', () => {
    const pcg = createPcg32({}, 42, 54)

    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const out = randomList(6, randomUint32, pcg)

    assert.equal(out.length, 6)
    assert.deepEqual(
      out.map((n) => n[0]),
      [2707161783, 2068313097, 3122475824, 2211639955, 3215226955, 3421331566]
    )

    // the next int after the 3rd state is the 4th int
    assert.equal(randomUint32(out[2][1])[0], out[3][0])
  })

  test('make sure there are no infinite loops', () => {
    for (let x = 0; x < 256; x++) {
      for (let y = 0; y < 256; y++) {
        const pcg = createPcg32({}, x, y)
        assert.notEqual(getOutput(pcg), 0)
      }
    }
  })
})
