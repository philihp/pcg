import { createSfc32, getOutput, nextState, randomInt, randomList, stepState } from '..'
import { PCGState } from '../types'

// Reference values produced by the canonical sfc32 (Chris Doty-Humphrey,
// PractRand) seeded with a=b=c=seed, d=1, and 15 warmup rounds:
//   function sfc32Step(s) {
//     const t = (((s.a + s.b) >>> 0) + s.d) >>> 0
//     return {
//       a: (s.b ^ (s.b >>> 9)) >>> 0,
//       b: (s.c + (s.c << 3)) >>> 0,
//       c: ((((s.c << 21) | (s.c >>> 11)) >>> 0) + t) >>> 0,
//       d: (s.d + 1) >>> 0,
//       t,
//     }
//   }
const CANONICAL_SEED_42 = [
  1296217524, 1908088579, 2163594420, 882717154, 1079537450, 41221136, 53294074, 1415219387,
]

describe('sfc32', () => {
  it('matches the canonical reference sequence for seed=42', () => {
    expect.assertions(1)
    let pcg = createSfc32(42)
    const out: number[] = []
    for (let i = 0; i < CANONICAL_SEED_42.length; i++) {
      out.push(getOutput(pcg))
      pcg = nextState(pcg)
    }
    expect(out).toStrictEqual(CANONICAL_SEED_42)
  })

  it('stamps state with variant: "sfc32"', () => {
    expect.assertions(1)
    expect(createSfc32(42).variant).toBe('sfc32')
  })

  it('drives randomInt without bias and stays in range', () => {
    expect.assertions(2)
    const rng = randomInt(0, 100)
    let pcg = createSfc32(7)
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
    const pcg = createSfc32(123)
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
    expect.assertions(2)
    const s0 = createSfc32(99)
    let walked = s0
    for (let i = 0; i < 7; i++) walked = nextState(walked)
    const jumped = stepState(7, s0)
    expect(jumped.state).toStrictEqual(walked.state)
    expect(jumped.streamId).toStrictEqual(walked.streamId)
  })

  it('throws on negative delta because sfc32 is not reversible', () => {
    expect.assertions(1)
    expect(() => stepState(-1, createSfc32(1))).toThrow(RangeError)
  })

  it('survives JSON serialization round-trips', () => {
    expect.assertions(1)
    const pcg = createSfc32(42)
    const revived = JSON.parse(JSON.stringify(pcg)) as PCGState
    const rng = randomInt(0, 2 ** 32 - 1)
    const a = randomList(8, rng, pcg).map(([v]) => v)
    const b = randomList(8, rng, revived).map(([v]) => v)
    expect(b).toStrictEqual(a)
  })

  it('accepts bigint, number, and string seeds', () => {
    expect.assertions(2)
    const a = createSfc32(42)
    const b = createSfc32(42n)
    const c = createSfc32('42')
    expect(b.state).toStrictEqual(a.state)
    expect(c.state).toStrictEqual(a.state)
  })
})
