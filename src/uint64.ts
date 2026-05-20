import { Uint64 } from './types'

const MASK_32 = 0xffffffffn

export const toBigInt = ({ hi, lo }: Uint64): bigint => (BigInt(hi) << 32n) | BigInt(lo)

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

// 64-bit unsigned multiplication mod 2^64, using 16-bit lane decomposition so
// that no intermediate product exceeds Number.MAX_SAFE_INTEGER.
export const mul64 = (a: Uint64, b: Uint64): Uint64 => {
  const a0 = a.lo & 0xffff
  const a1 = a.lo >>> 16
  const a2 = a.hi & 0xffff
  const a3 = a.hi >>> 16
  const b0 = b.lo & 0xffff
  const b1 = b.lo >>> 16
  const b2 = b.hi & 0xffff
  const b3 = b.hi >>> 16

  const lane0 = a0 * b0
  let lane1 = a0 * b1 + a1 * b0
  let lane2 = a0 * b2 + a1 * b1 + a2 * b0
  let lane3 = a0 * b3 + a1 * b2 + a2 * b1 + a3 * b0

  const w0 = lane0 & 0xffff
  lane1 += Math.floor(lane0 / 0x10000)
  const w1 = lane1 & 0xffff
  lane2 += Math.floor(lane1 / 0x10000)
  const w2 = lane2 & 0xffff
  lane3 += Math.floor(lane2 / 0x10000)
  const w3 = lane3 & 0xffff

  return {
    hi: ((w3 << 16) | w2) >>> 0,
    lo: ((w1 << 16) | w0) >>> 0,
  }
}
