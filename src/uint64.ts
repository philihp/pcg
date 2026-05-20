import { Uint64 } from './types'

// 64-bit unsigned integer math on {hi, lo} pairs of uint32 numbers.
// JS bitwise ops are 32-bit; full 64-bit multiplication is done by splitting
// each operand into four 16-bit limbs so partial products fit in 53 bits.

// (a * m + i) mod 2^64
export const mulAdd64 = (aHi: number, aLo: number, mHi: number, mLo: number, iHi: number, iLo: number): Uint64 => {
  const a0 = aLo & 0xffff
  const a1 = aLo >>> 16
  const a2 = aHi & 0xffff
  const a3 = aHi >>> 16
  const m0 = mLo & 0xffff
  const m1 = mLo >>> 16
  const m2 = mHi & 0xffff
  const m3 = mHi >>> 16

  const c0 = a0 * m0 + (iLo & 0xffff)
  let c1 = (c0 >>> 16) + a1 * m0 + (iLo >>> 16)
  let c2 = c1 >>> 16
  c1 = (c1 & 0xffff) + a0 * m1
  c2 += c1 >>> 16
  let c3 = c2 >>> 16
  c2 = (c2 & 0xffff) + a2 * m0 + (iHi & 0xffff)
  c3 += c2 >>> 16
  c2 = (c2 & 0xffff) + a1 * m1
  c3 += c2 >>> 16
  c2 = (c2 & 0xffff) + a0 * m2
  c3 += c2 >>> 16
  c3 = (c3 & 0xffff) + a3 * m0 + a2 * m1 + a1 * m2 + a0 * m3 + (iHi >>> 16)

  return {
    hi: (((c3 & 0xffff) << 16) | (c2 & 0xffff)) >>> 0,
    lo: (((c1 & 0xffff) << 16) | (c0 & 0xffff)) >>> 0,
  }
}

export const mul64 = (aHi: number, aLo: number, bHi: number, bLo: number): Uint64 => mulAdd64(aHi, aLo, bHi, bLo, 0, 0)

// Convert a JS number to its 64-bit two's-complement representation (mod 2^64).
// Negative numbers wrap, matching `BigInt(n) & 0xffffffffffffffffn`.
export const numberToU64 = (n: number): Uint64 => {
  const lo = n >>> 0
  const hi = ((n - lo) / 0x100000000) >>> 0
  return { hi, lo }
}
