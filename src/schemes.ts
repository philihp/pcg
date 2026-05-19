import { PCGState } from './types'

const MASK_64 = 0xffffffffffffffffn

// Mulberry32: 32-bit state, 32-bit output PRNG by Tommy Ettinger.
// Reference: https://gist.github.com/tommyettinger/46a3a48dac63b1bb4513bf61aa66da9b
// All arithmetic is performed in JS number space using Math.imul and bitwise
// ops; nothing touches BigInt.
const mulberry32Step = (a: number): { state: number; out: number } => {
  const state = (a + 0x6d2b79f5) | 0
  let t = state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return { state, out: (t ^ (t >>> 14)) >>> 0 }
}

// SFC32 ("Small Fast Counter") by Chris Doty-Humphrey, 128-bit state, 32-bit
// output. All arithmetic stays in JS number space.
// Reference: https://pracrand.sourceforge.net/RNG_engines.txt
const sfc32Step = (
  a: number,
  b: number,
  c: number,
  d: number
): { a: number; b: number; c: number; d: number; out: number } => {
  const t = (((a + b) | 0) + d) | 0
  const nextD = (d + 1) | 0
  const nextA = b ^ (b >>> 9)
  const nextB = (c + (c << 3)) | 0
  const rotC = (c << 21) | (c >>> 11)
  const nextC = (rotC + t) | 0
  return { a: nextA, b: nextB, c: nextC, d: nextD, out: t >>> 0 }
}

// Derive a 64-bit LCG increment from the streamId by scrambling its two 32-bit
// halves through mulberry32. The result is forced odd, matching the SETSEQ
// requirement for PCG to reach its full period.
export const mulberry32Scheme = (pcg: PCGState): bigint => {
  const lo = pcg.streamId.lo | 0
  const hi = pcg.streamId.hi | 0
  const first = mulberry32Step(lo)
  const second = mulberry32Step((first.state ^ hi) | 0)
  return (((BigInt(second.out) << 32n) | BigInt(first.out)) | 1n) & MASK_64
}

// Derive a 64-bit LCG increment from the streamId by scrambling it through
// sfc32 with the standard 12-round warmup. The result is forced odd.
export const sfc32Scheme = (pcg: PCGState): bigint => {
  let a = pcg.streamId.lo | 0
  let b = pcg.streamId.hi | 0
  let c = 0
  let d = 1
  for (let i = 0; i < 12; i++) {
    const r = sfc32Step(a, b, c, d)
    a = r.a
    b = r.b
    c = r.c
    d = r.d
  }
  const first = sfc32Step(a, b, c, d)
  const second = sfc32Step(first.a, first.b, first.c, first.d)
  return (((BigInt(second.out) << 32n) | BigInt(first.out)) | 1n) & MASK_64
}
