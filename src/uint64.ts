import type { Uint64 } from './types'

const MASK_32 = 0xffffffffn

/**
 * @deprecated Will be removed in 3.0.0. The library no longer uses BigInt
 * internally; if you need a bigint, do `(BigInt(hi) << 32n) | BigInt(lo)` at
 * the call site.
 */
export const toBigInt = ({ hi, lo }: Uint64): bigint => (BigInt(hi) << 32n) | BigInt(lo)

/**
 * @deprecated Will be removed in 3.0.0. The library no longer uses BigInt
 * internally; if you need to construct a Uint64 from a bigint, split it as
 * `{ hi: Number((v >> 32n) & 0xffffffffn), lo: Number(v & 0xffffffffn) }`.
 */
export const fromBigInt = (value: bigint): Uint64 => ({
  hi: Number((value >> 32n) & MASK_32),
  lo: Number(value & MASK_32),
})

// Convert a JS number (treated as a signed 64-bit integer) to Uint64.
// Negative values are encoded as two's complement modulo 2^64.
export const fromNumber = (value: number): Uint64 => {
  if (value >= 0) {
    return {
      hi: Math.floor(value / 0x100000000) >>> 0,
      lo: value >>> 0,
    }
  }
  const absLo = -value >>> 0
  const absHi = Math.floor(-value / 0x100000000) >>> 0
  const invLo = ~absLo >>> 0
  const invHi = ~absHi >>> 0
  const sumLo = invLo + 1
  const lo = sumLo >>> 0
  const carry = sumLo > 0xffffffff ? 1 : 0
  return { hi: (invHi + carry) >>> 0, lo }
}

// 64-bit unsigned addition mod 2^64.
export const add64 = (a: Uint64, b: Uint64): Uint64 => {
  const sumLo = a.lo + b.lo
  const lo = sumLo >>> 0
  const carry = sumLo > 0xffffffff ? 1 : 0
  return { hi: (a.hi + b.hi + carry) >>> 0, lo }
}

// High 32 bits of the full 64-bit product of two unsigned 32-bit values. The
// product itself can reach 2^64, past what a double holds exactly, so both
// operands are split into 16-bit halves: every partial product stays below
// 2^32 and every sum below 2^34, all exact in IEEE-754. Integer shifts and
// masks beat the float divide-and-floor alternative in both V8 flavours.
export const mulHi32 = (a: number, b: number): number => {
  const a0 = a & 0xffff
  const a1 = a >>> 16
  const b0 = b & 0xffff
  const b1 = b >>> 16
  const p00 = a0 * b0
  const p01 = a0 * b1
  const p10 = a1 * b0
  const p11 = a1 * b1
  const midCarry = ((p00 >>> 16) + (p01 & 0xffff) + (p10 & 0xffff)) >>> 16
  return (p11 + (p01 >>> 16) + (p10 >>> 16) + midCarry) >>> 0
}

// High word of the product (aHi:aLo) * (bHi:bLo) mod 2^64. The low word is
// just the low 32 bits of aLo * bLo, which Math.imul gives directly; the high
// word needs the full 64-bit product of aLo * bLo (mulHi32), while the cross
// terms aLo*bHi and aHi*bLo contribute only to the high half mod 2^64 and so
// can also use Math.imul.
export const mulHi64 = (aHi: number, aLo: number, bHi: number, bLo: number): number =>
  (mulHi32(aLo, bLo) + Math.imul(aLo, bHi) + Math.imul(aHi, bLo)) >>> 0

// 64-bit unsigned multiplication mod 2^64.
export const mul64 = (a: Uint64, b: Uint64): Uint64 => ({
  hi: mulHi64(a.hi, a.lo, b.hi, b.lo),
  lo: Math.imul(a.lo, b.lo) >>> 0,
})
