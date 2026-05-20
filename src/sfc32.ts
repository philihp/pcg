import { OutputFnType, PCGState, StreamScheme } from './types'

// Chris Doty-Humphrey's sfc32: a 128-bit-state chaotic PRNG built from add,
// xor, shift, and rotate. Fast, passes PractRand, and well-suited to JS since
// every operation fits in 32 bits. State is packed as a=state.hi, b=state.lo,
// c=streamId.hi, counter=streamId.lo. Not reversible — negative deltas throw.
const BARREL_SHIFT = 21
const RSHIFT = 9
const LSHIFT = 3
const WARMUP_ROUNDS = 15

type Sfc32Registers = { a: number; b: number; c: number; d: number }

const step = ({ a, b, c, d }: Sfc32Registers): Sfc32Registers => {
  const t = (((a + b) >>> 0) + d) >>> 0
  return {
    a: (b ^ (b >>> RSHIFT)) >>> 0,
    b: (c + (c << LSHIFT)) >>> 0,
    c: ((((c << BARREL_SHIFT) | (c >>> (32 - BARREL_SHIFT))) >>> 0) + t) >>> 0,
    d: (d + 1) >>> 0,
  }
}

const unpack = (pcg: PCGState): Sfc32Registers => ({
  a: pcg.state.hi,
  b: pcg.state.lo,
  c: pcg.streamId.hi,
  d: pcg.streamId.lo,
})

const pack = (pcg: PCGState, { a, b, c, d }: Sfc32Registers): PCGState => ({
  ...pcg,
  state: { hi: a, lo: b },
  streamId: { hi: c, lo: d },
})

export const sfc32Advance = (pcg: PCGState, delta: number): PCGState => {
  if (delta < 0) throw new RangeError('sfc32 is not reversible; negative delta is unsupported')
  let regs = unpack(pcg)
  for (let i = 0; i < delta; i++) regs = step(regs)
  return pack(pcg, regs)
}

export const sfc32Output = (pcg: PCGState): number =>
  (((pcg.state.hi + pcg.state.lo) >>> 0) + pcg.streamId.lo) >>> 0

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
