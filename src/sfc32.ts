import { withState } from './state'
import { OutputFnType, StreamScheme } from './types'
import type { PCGState } from './types'

// Chris Doty-Humphrey's sfc32: a 128-bit-state chaotic PRNG built from add,
// xor, shift, and rotate. Fast, passes PractRand, and well-suited to JS since
// every operation fits in 32 bits. State is packed as a=state.hi, b=state.lo,
// c=streamId.hi, counter=streamId.lo. Not reversible — negative deltas throw.
const BARREL_SHIFT = 21
const RSHIFT = 9
const LSHIFT = 3
const WARMUP_ROUNDS = 15

export const sfc32Advance = (pcg: PCGState, delta: number): PCGState => {
  if (delta < 0) throw new RangeError('sfc32 is not reversible; negative delta is unsupported')
  let a = pcg.state.hi
  let b = pcg.state.lo
  let c = pcg.streamId.hi
  let d = pcg.streamId.lo
  // The registers stay in locals for the whole walk; each round reads the
  // previous round's values, and only the returned state is allocated.
  for (let i = 0; i < delta; i++) {
    const t = (((a + b) >>> 0) + d) >>> 0
    a = (b ^ (b >>> RSHIFT)) >>> 0
    b = (c + (c << LSHIFT)) >>> 0
    c = ((((c << BARREL_SHIFT) | (c >>> (32 - BARREL_SHIFT))) >>> 0) + t) >>> 0
    d = (d + 1) >>> 0
  }
  return withState(pcg, { hi: a, lo: b }, { hi: c, lo: d })
}

export const sfc32Output = (pcg: PCGState): number => (((pcg.state.hi + pcg.state.lo) >>> 0) + pcg.streamId.lo) >>> 0

export const createSfc32 = (seed: bigint | number | string): PCGState => {
  const seedLo = Number(BigInt(seed) & 0xffffffffn)
  const seeded: PCGState = {
    state: { hi: seedLo, lo: seedLo },
    streamId: { hi: seedLo, lo: 1 },
    variant: 'sfc32',
    outputFnType: OutputFnType.XSH_RR,
    streamScheme: StreamScheme.SETSEQ,
  }
  return sfc32Advance(seeded, WARMUP_ROUNDS)
}
