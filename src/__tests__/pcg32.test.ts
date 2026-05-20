import { createPcg64, randomInt64, randomList64 } from '..'
import {
  createPcg32,
  getOutput,
  nextState,
  prevState,
  randomInt,
  randomList,
  randomUint32,
  stepState,
} from '../createPcg'

describe('default PCG32 (BigInt-free)', () => {
  it('produces the documented XSH_RR sequence', () => {
    expect.assertions(6)
    let pcg = createPcg32(42, 54)
    const expected = [0xa15c02b7, 0x7b47f409, 0xba1d3330, 0x83d2f293, 0xbfa4784b, 0xcbed606e]
    for (const want of expected) {
      const [n, next] = randomUint32(pcg)
      expect(n).toBe(want)
      pcg = next
    }
  })

  it('matches the createPcg64 output for the default (SETSEQ + XSH_RR) config', () => {
    expect.assertions(64)
    const slow = createPcg64({}, 42, 54)
    const fast = createPcg32(42, 54)
    const u32 = randomInt64(0, 2 ** 32 - 1)
    const slowList = randomList64(64, u32, slow).map(([v]) => v)
    let cur = fast
    for (let i = 0; i < 64; i++) {
      const [v, next] = randomUint32(cur)
      expect(v).toBe(slowList[i])
      cur = next
    }
  })

  it('matches createPcg64 output across many seeds', () => {
    expect.assertions(256)
    const u32 = randomInt64(0, 2 ** 32 - 1)
    for (let seed = 0; seed < 16; seed++) {
      for (let stream = 0; stream < 16; stream++) {
        const slow = createPcg64({}, seed, stream)
        const fast = createPcg32(seed, stream)
        expect(randomUint32(fast)[0]).toBe(u32(slow)[0])
      }
    }
  })

  it('rejection-samples within [min, max)', () => {
    expect.assertions(2)
    const pcg = createPcg32(42, 54)
    const [v] = randomInt(0, 100, pcg)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThan(100)
  })

  it('rejects invalid bounds', () => {
    expect.assertions(2)
    const pcg = createPcg32(42, 54)
    expect(() => randomInt(0, -1, pcg)).toThrow(RangeError)
    expect(() => randomInt(0, 2 ** 32 + 1, pcg)).toThrow(RangeError)
  })

  it('supports bound === 2^32 with no rejection', () => {
    expect.assertions(1)
    const pcg = createPcg32(42, 54)
    const [v] = randomInt(0, 2 ** 32, pcg)
    expect(v).toBe(0xa15c02b7)
  })

  it('randomList returns the expected sequence', () => {
    expect.assertions(1)
    const pcg = createPcg32(42, 54)
    const list = randomList(6, randomUint32, pcg).map(([v]) => v)
    expect(list).toStrictEqual([0xa15c02b7, 0x7b47f409, 0xba1d3330, 0x83d2f293, 0xbfa4784b, 0xcbed606e])
  })

  it('randomList of zero length is empty', () => {
    expect.assertions(1)
    const pcg = createPcg32(42, 54)
    expect(randomList(0, randomUint32, pcg)).toStrictEqual([])
  })

  it('stepState(N) equals N applications of nextState', () => {
    expect.assertions(1)
    const pcg = createPcg32(42, 54)
    let stepped = pcg
    for (let i = 0; i < 7; i++) stepped = nextState(stepped)
    const jumped = stepState(7, pcg)
    expect(getOutput(jumped)).toBe(getOutput(stepped))
  })

  it('prevState undoes nextState', () => {
    expect.assertions(2)
    const pcg = createPcg32(42, 54)
    const back = prevState(nextState(pcg))
    expect(back.sHi).toBe(pcg.sHi)
    expect(back.sLo).toBe(pcg.sLo)
  })

  it('state contains no functions and no bigints (JSON-safe)', () => {
    expect.assertions(1)
    const pcg = createPcg32(42, 54)
    const json = JSON.stringify(pcg)
    const revived = JSON.parse(json) as typeof pcg
    expect(randomUint32(revived)[0]).toBe(randomUint32(pcg)[0])
  })
})
