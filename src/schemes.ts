import { CustomRng, PCGState } from './types'

const MASK_32 = 0xffffffffn

const lo32 = (v: bigint): number => Number(v & MASK_32) | 0
const hi32 = (v: bigint): number => Number((v >> 32n) & MASK_32) | 0

// =====================================================================
// Mulberry32 — 32-bit state, 32-bit output. By Tommy Ettinger.
// https://gist.github.com/tommyettinger/46a3a48dac63b1bb4513bf61aa66da9b
//
// Packing: state.lo holds the 32-bit `a`. state.hi and streamId are unused.
// All hot-path arithmetic is plain JS number ops (Math.imul / bitwise).
// =====================================================================

const MULBERRY32_K = 0x6d2b79f5

const mulberry32Step = (pcg: PCGState): PCGState => ({
  ...pcg,
  state: { hi: 0, lo: ((pcg.state.lo + MULBERRY32_K) | 0) >>> 0 },
})

const mulberry32Output = (pcg: PCGState): number => {
  let t = pcg.state.lo | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return (t ^ (t >>> 14)) >>> 0
}

// a_n = a_0 + n * K (mod 2^32). Linear, so jump-ahead is one Math.imul.
const mulberry32Jump = (delta: number, pcg: PCGState): PCGState => ({
  ...pcg,
  state: { hi: 0, lo: ((pcg.state.lo + Math.imul(delta | 0, MULBERRY32_K)) | 0) >>> 0 },
})

const mulberry32Init = (initState: bigint, initStreamId: bigint, base: PCGState): PCGState => {
  // Fold both seed inputs into a single 32-bit `a`. XOR the four 32-bit halves
  // so every bit of either input influences the seed.
  const seed = (lo32(initState) ^ hi32(initState) ^ lo32(initStreamId) ^ hi32(initStreamId)) | 0
  return mulberry32Step({
    ...base,
    state: { hi: 0, lo: seed >>> 0 },
    streamId: { hi: 0, lo: 0 },
  })
}

export const mulberry32: CustomRng = {
  init: mulberry32Init,
  step: mulberry32Step,
  output: mulberry32Output,
  jump: mulberry32Jump,
}

// =====================================================================
// SFC32 ("Small Fast Counter") — 128-bit state, 32-bit output.
// By Chris Doty-Humphrey, https://pracrand.sourceforge.net/RNG_engines.txt
//
// Packing: state.lo = a, state.hi = b, streamId.lo = c, streamId.hi = d.
// We reuse the streamId slots so PCGState's shape (and JSON serialization)
// is unchanged. All hot-path arithmetic is plain JS number ops.
// =====================================================================

const sfc32Step = (pcg: PCGState): PCGState => {
  const a = pcg.state.lo | 0
  const b = pcg.state.hi | 0
  const c = pcg.streamId.lo | 0
  const d = pcg.streamId.hi | 0
  const t = (((a + b) | 0) + d) | 0
  const newA = (b ^ (b >>> 9)) >>> 0
  const newB = ((c + (c << 3)) | 0) >>> 0
  const rotC = (c << 21) | (c >>> 11)
  const newC = ((rotC + t) | 0) >>> 0
  const newD = ((d + 1) | 0) >>> 0
  return {
    ...pcg,
    state: { hi: newB, lo: newA },
    streamId: { hi: newD, lo: newC },
  }
}

// The output of sfc32 is `a + b + d`, computed at the start of the step.
const sfc32Output = (pcg: PCGState): number => {
  const a = pcg.state.lo | 0
  const b = pcg.state.hi | 0
  const d = pcg.streamId.hi | 0
  return ((((a + b) | 0) + d) | 0) >>> 0
}

const sfc32Init = (initState: bigint, initStreamId: bigint, base: PCGState): PCGState => {
  // Map both seed bigints into the four 32-bit slots. d starts at 1 to ensure
  // the counter is non-zero (matching the canonical seeding recipe), with
  // initStreamId's high half folded in for extra stream separation.
  const a = lo32(initState)
  const b = hi32(initState)
  const c = lo32(initStreamId)
  const d = (hi32(initStreamId) + 1) | 0
  let curr: PCGState = {
    ...base,
    state: { hi: b >>> 0, lo: a >>> 0 },
    streamId: { hi: d >>> 0, lo: c >>> 0 },
  }
  for (let i = 0; i < 12; i++) curr = sfc32Step(curr)
  return curr
}

export const sfc32: CustomRng = {
  init: sfc32Init,
  step: sfc32Step,
  output: sfc32Output,
}
