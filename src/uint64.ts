import { Uint64 } from './types'

// Convert a JS number (treated as a signed 64-bit integer) to Uint64.
// Negative values are encoded as two's complement modulo 2^64.
export const fromNumber = (value: number): Uint64 => {
  if (value >= 0) {
    return {
      hi: Math.floor(value / 0x100000000) >>> 0,
      lo: value >>> 0,
    }
  }
  const absLo = (-value) >>> 0
  const absHi = Math.floor(-value / 0x100000000) >>> 0
  const invLo = (~absLo) >>> 0
  const invHi = (~absHi) >>> 0
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

// 64-bit unsigned multiplication mod 2^64. The low 32 bits of the result are
// just the low 32 bits of (a.lo * b.lo), which Math.imul gives us directly.
// For the high 32 bits we need the full 64-bit product of two 32-bit values,
// which still requires a 16-bit lane split — but only for that single product,
// since cross terms (a.lo*b.hi, a.hi*b.lo) contribute only to the high half
// mod 2^64 and so can also use Math.imul.
export const mul64 = (a: Uint64, b: Uint64): Uint64 => {
  const aLo = a.lo
  const aHi = a.hi
  const bLo = b.lo
  const bHi = b.hi

  const lo = Math.imul(aLo, bLo) >>> 0

  const a0 = aLo & 0xffff
  const a1 = aLo >>> 16
  const b0 = bLo & 0xffff
  const b1 = bLo >>> 16
  const p00 = a0 * b0
  const p01 = a0 * b1
  const p10 = a1 * b0
  const p11 = a1 * b1
  const midCarry = ((p00 >>> 16) + (p01 & 0xffff) + (p10 & 0xffff)) >>> 16
  const llHi = p11 + (p01 >>> 16) + (p10 >>> 16) + midCarry

  const hi = (llHi + Math.imul(aLo, bHi) + Math.imul(aHi, bLo)) >>> 0
  return { hi, lo }
}
