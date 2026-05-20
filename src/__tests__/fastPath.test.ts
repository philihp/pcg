import { createPcg32, getOutput, nextState, prevState, randomInt, stepState } from '..'
import { OutputFnType, PCGState, StreamScheme, Uint64 } from '../types'

const MASK_32 = 0xffffffffn
const MASK_64 = 0xffffffffffffffffn
const MULT = 6364136223846793005n
const INC = 1442695040888963407n

const toBig = ({ hi, lo }: Uint64): bigint => (BigInt(hi) << 32n) | BigInt(lo)
const fromBig = (v: bigint): Uint64 => ({
  hi: Number((v >> 32n) & MASK_32),
  lo: Number(v & MASK_32),
})

// Reference BigInt implementation of the LCG advance, used to cross-check the
// number-based fast path.
const referenceNext = (state: bigint, increment: bigint): bigint => (state * MULT + increment) & MASK_64

describe('fast path correctness vs BigInt reference', () => {
  it('nextState matches the BigInt LCG for SETSEQ across 1k iterations', () => {
    expect.assertions(1000)
    const pcg = createPcg32({ streamScheme: StreamScheme.SETSEQ }, 42, 54)
    const streamInc = ((BigInt(54) & MASK_64) << 1n) | 1n
    let live: PCGState = pcg
    let refState = toBig(pcg.state)
    for (let i = 0; i < 1000; i++) {
      live = nextState(live)
      refState = referenceNext(refState, streamInc)
      expect(live.state).toEqual(fromBig(refState))
    }
  })

  it('nextState matches the BigInt LCG for ONESEQ across 1k iterations', () => {
    expect.assertions(1000)
    const pcg = createPcg32({ streamScheme: StreamScheme.ONESEQ }, 42, 54)
    let live: PCGState = pcg
    let refState = toBig(pcg.state)
    for (let i = 0; i < 1000; i++) {
      live = nextState(live)
      refState = referenceNext(refState, INC)
      expect(live.state).toEqual(fromBig(refState))
    }
  })

  it('nextState matches the BigInt MCG (zero increment) across 1k iterations', () => {
    expect.assertions(1000)
    const pcg = createPcg32({ streamScheme: StreamScheme.MCG }, 42, 54)
    let live: PCGState = pcg
    let refState = toBig(pcg.state)
    for (let i = 0; i < 1000; i++) {
      live = nextState(live)
      refState = referenceNext(refState, 0n)
      expect(live.state).toEqual(fromBig(refState))
    }
  })
})

describe('stepState fast-exponentiation', () => {
  it('agrees with repeated nextState across a range of deltas', () => {
    const positiveDeltas = [1, 2, 3, 7, 16, 100, 10_000]
    expect.assertions(positiveDeltas.length * 2 + 1)
    const pcg = createPcg32({}, 42, 54)
    expect(stepState(0, pcg)).toEqual(pcg)
    for (const delta of positiveDeltas) {
      let walked = pcg
      for (let i = 0; i < delta; i++) walked = nextState(walked)
      const jumped = stepState(delta, pcg)
      expect(jumped.state).toEqual(walked.state)
      expect(stepState(-delta, jumped).state).toEqual(pcg.state)
    }
  })

  it('round-trips state through nextState/prevState chains', () => {
    expect.assertions(50)
    let pcg = createPcg32({}, 7, 11)
    for (let i = 0; i < 50; i++) {
      const moved = prevState(nextState(pcg))
      expect(moved.state).toEqual(pcg.state)
      pcg = nextState(pcg)
    }
  })
})

describe('output functions over a large sample', () => {
  it.each([
    [OutputFnType.XSH_RR],
    [OutputFnType.XSH_RS],
    [OutputFnType.XSL_RR],
    [OutputFnType.RXS_M_XS],
  ])('produces 32-bit unsigned outputs for %i', (outputFnType) => {
    const pcg = createPcg32({ outputFnType }, 42, 54)
    const rng = randomInt(0, 2 ** 32 - 1)
    let s = pcg
    for (let i = 0; i < 1000; i++) {
      const n = getOutput(s)
      expect(Number.isInteger(n)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(0xffffffff)
      s = rng(s)[1]
    }
  })
})
