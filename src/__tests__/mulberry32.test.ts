import { createMulberry32, getOutput, nextState, prevState, randomInt, randomList, stepState } from '..'
import { PCGState } from '../types'

// Reference values produced by Tommy Ettinger's canonical mulberry32(seed=42):
//   function mulberry32(a) {
//     return function() {
//       a |= 0; a = a + 0x6D2B79F5 | 0;
//       let t = a;
//       t = Math.imul(t ^ t >>> 15, t | 1);
//       t ^= t + Math.imul(t ^ t >>> 7, t | 61);
//       return ((t ^ t >>> 14) >>> 0);
//     }
//   }
const CANONICAL_SEED_42 = [
  2581720956, 1925393290, 3661312704, 2876485805, 750819978, 2261697747, 1173505300, 2683257857,
]

describe('mulberry32', () => {
  it('matches the canonical reference sequence for seed=42', () => {
    expect.assertions(1)
    let pcg = createMulberry32(42)
    const out: number[] = []
    for (let i = 0; i < CANONICAL_SEED_42.length; i++) {
      out.push(getOutput(pcg))
      pcg = nextState(pcg)
    }
    expect(out).toStrictEqual(CANONICAL_SEED_42)
  })

  it('stamps state with variant: "mulberry32"', () => {
    expect.assertions(1)
    expect(createMulberry32(42).variant).toBe('mulberry32')
  })

  it('drives randomInt without bias and stays in range', () => {
    expect.assertions(2)
    const rng = randomInt(0, 100)
    let pcg = createMulberry32(7)
    let minSeen = 100
    let maxSeen = 0
    for (let i = 0; i < 1000; i++) {
      const [v, next] = rng(pcg)
      if (v < minSeen) minSeen = v
      if (v > maxSeen) maxSeen = v
      pcg = next
    }
    expect(minSeen).toBeGreaterThanOrEqual(0)
    expect(maxSeen).toBeLessThan(100)
  })

  it('produces the same sequence through randomList as through nextState', () => {
    expect.assertions(1)
    const rng = randomInt(0, 2 ** 32 - 1)
    const pcg = createMulberry32(123)
    const listed = randomList(5, rng, pcg).map(([v]) => v)

    const stepped: number[] = []
    let curr = pcg
    for (let i = 0; i < 5; i++) {
      const [v, next] = rng(curr)
      stepped.push(v)
      curr = next
    }
    expect(stepped).toStrictEqual(listed)
  })

  it('stepState(n) advances by n single steps', () => {
    expect.assertions(1)
    const s0 = createMulberry32(99)
    let walked = s0
    for (let i = 0; i < 7; i++) walked = nextState(walked)
    const jumped = stepState(7, s0)
    expect(jumped.state).toStrictEqual(walked.state)
  })

  it('prevState undoes nextState', () => {
    expect.assertions(1)
    const s0 = createMulberry32(2026)
    expect(prevState(nextState(s0)).state).toStrictEqual(s0.state)
  })

  it('survives JSON serialization round-trips', () => {
    expect.assertions(1)
    const pcg = createMulberry32(42)
    const revived = JSON.parse(JSON.stringify(pcg)) as PCGState
    const rng = randomInt(0, 2 ** 32 - 1)
    const a = randomList(8, rng, pcg).map(([v]) => v)
    const b = randomList(8, rng, revived).map(([v]) => v)
    expect(b).toStrictEqual(a)
  })

  it('accepts bigint, number, and string seeds', () => {
    expect.assertions(2)
    const a = createMulberry32(42)
    const b = createMulberry32(42n)
    const c = createMulberry32('42')
    expect(b.state).toStrictEqual(a.state)
    expect(c.state).toStrictEqual(a.state)
  })
})
