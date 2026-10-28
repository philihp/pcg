import { ror32 } from './bitwise'
import {
  pcgDefaultIncrement64,
  pcgDefaultMultiplier64,
  pcgDefaultMultiplierInverse64,
  pcgDefaultOutputFnType,
  pcgDefaultStreamScheme,
} from './defaults'
import { withState } from './state'
import { OutputFnType, StreamScheme } from './types'
import type { CreatePcgOptions, PCGState, Uint64 } from './types'
import { add64, fromBigInt, fromNumber, mulHi64 } from './uint64'

const MULTIPLIER: Uint64 = fromBigInt(pcgDefaultMultiplier64)
const MULTIPLIER_INVERSE: Uint64 = fromBigInt(pcgDefaultMultiplierInverse64)
const INCREMENT: Uint64 = fromBigInt(pcgDefaultIncrement64)
const ZERO_U64: Uint64 = { hi: 0, lo: 0 }

const STREAM_SCHEMES: ReadonlySet<number> = new Set(Object.values(StreamScheme))

const unknownStreamScheme = (streamScheme: never): never => {
  throw new TypeError(`Unknown stream scheme: ${String(streamScheme)}`)
}

// The increment each step adds. SETSEQ reads it from the state; the other two
// schemes use a constant.
const incrementOf = (pcg: PCGState): Uint64 => {
  switch (pcg.streamScheme) {
    case StreamScheme.SETSEQ:
      return pcg.streamId
    case StreamScheme.ONESEQ:
      return INCREMENT
    case StreamScheme.MCG:
      return ZERO_U64
    default:
      return unknownStreamScheme(pcg.streamScheme)
  }
}

// 62169 fits in 17 bits, so its product with any 32-bit value stays below 2^49
// and is exact in IEEE-754. RXS_M_XS exploits this to skip the generic mul64.
const RXS_MULT = 62169

const xshRr = (hi: number, lo: number): number => {
  const rot = hi >>> 27
  const xorLo = (((lo >>> 18) | (hi << 14)) ^ lo) >>> 0
  const xorHi = (hi >>> 18) ^ hi
  const word = ((xorLo >>> 27) | (xorHi << 5)) >>> 0
  return ror32(rot, word)
}

const xshRs = (hi: number, lo: number): number => {
  const shift = (hi >>> 29) + 22
  const xorLo = (((lo >>> 22) | (hi << 10)) ^ lo) >>> 0
  const xorHi = ((hi >>> 22) ^ hi) >>> 0
  return ((xorLo >>> shift) | (xorHi << (32 - shift))) >>> 0
}

const xslRr = (hi: number, lo: number): number => ror32(hi >>> 27, (hi ^ lo) >>> 0)

const rxsMXs = (hi: number, lo: number): number => {
  // (state >>> 13) + 3, with the carry out of the low word
  const sumLo = (((lo >>> 13) | (hi << 19)) >>> 0) + 3
  const aLo = sumLo >>> 0
  const aHi = ((hi >>> 13) + (sumLo > 0xffffffff ? 1 : 0)) >>> 0
  const xLo = (aLo ^ lo) >>> 0
  const xHi = (aHi ^ hi) >>> 0
  const mLo = xLo * RXS_MULT
  const mHi = xHi * RXS_MULT
  const wordLo = mLo >>> 0
  const carry = Math.floor(mLo / 0x100000000)
  const wordHi = (mHi + carry) >>> 0
  return (((wordLo >>> 11) | (wordHi << 21)) ^ wordLo) >>> 0
}

const unknownOutputFn = (outputFnType: never): never => {
  throw new TypeError(`Unknown output function: ${String(outputFnType)}`)
}

// A switch rather than a lookup table, so each case is a direct call to a
// known function that the engine can inline.
export const pcg32Output = (pcg: PCGState): number => {
  const { hi, lo } = pcg.state
  switch (pcg.outputFnType) {
    case OutputFnType.XSH_RR:
      return xshRr(hi, lo)
    case OutputFnType.XSH_RS:
      return xshRs(hi, lo)
    case OutputFnType.XSL_RR:
      return xslRr(hi, lo)
    case OutputFnType.RXS_M_XS:
      return rxsMXs(hi, lo)
    default:
      return unknownOutputFn(pcg.outputFnType)
  }
}

const resolveStreamScheme = (streamScheme: StreamScheme | keyof typeof StreamScheme): StreamScheme => {
  const resolved: StreamScheme = typeof streamScheme === 'string' ? StreamScheme[streamScheme] : streamScheme
  if (resolved === undefined || !STREAM_SCHEMES.has(resolved)) {
    throw new Error(`Unknown stream scheme: ${String(streamScheme)}`)
  }
  return resolved
}

// (hi, lo) * multiplier + increment mod 2^64, as a fresh state on `pcg`. This
// is mul64 followed by add64 with the arithmetic written out, so a step
// allocates nothing but the state it returns.
const affine = (pcg: PCGState, hi: number, lo: number, multiplier: Uint64, increment: Uint64): PCGState => {
  const productHi = mulHi64(hi, lo, multiplier.hi, multiplier.lo)
  const sumLo = (Math.imul(lo, multiplier.lo) >>> 0) + increment.lo
  const carry = sumLo > 0xffffffff ? 1 : 0
  return withState(pcg, { hi: (productHi + increment.hi + carry) >>> 0, lo: sumLo >>> 0 })
}

// One step forward: the common case, driven by nextState and randomInt.
const stepForward = (pcg: PCGState): PCGState => affine(pcg, pcg.state.hi, pcg.state.lo, MULTIPLIER, incrementOf(pcg))

// One step back: (state - increment) * multiplier^-1 mod 2^64. The multiplier
// is odd, so the LCG is a bijection on 2^64 states and this is its exact
// inverse; it lands on the same state as the 64-round jump-ahead below.
const stepBack = (pcg: PCGState): PCGState => {
  const increment = incrementOf(pcg)
  const { hi, lo } = pcg.state
  const borrow = lo < increment.lo ? 1 : 0
  return affine(pcg, (hi - increment.hi - borrow) >>> 0, (lo - increment.lo) >>> 0, MULTIPLIER_INVERSE, ZERO_U64)
}

/* Multi-step advance (jump-ahead, jump-back)
 *
 * Brown, "Random Number Generation with Arbitrary Stride," Transactions of the American Nuclear
 * Society (Nov. 1994). Even though delta is unsigned in principle, passing a signed number works
 * by going "the long way round" via two's complement.
 */
const jump = (pcg: PCGState, delta: number): PCGState => {
  const increment = incrementOf(pcg)

  // The four running 64-bit quantities live in local halves, so a round
  // allocates nothing; only the result's two coefficients are built.
  let currMultiplierHi = MULTIPLIER.hi
  let currMultiplierLo = MULTIPLIER.lo
  let currIncrementHi = increment.hi
  let currIncrementLo = increment.lo
  let accMultiplierHi = 0
  let accMultiplierLo = 1
  let accIncrementHi = 0
  let accIncrementLo = 0

  const remaining = fromNumber(delta)
  let remHi = remaining.hi
  let remLo = remaining.lo

  while (remHi !== 0 || remLo !== 0) {
    if ((remLo & 1) === 1) {
      // accMultiplier *= currMultiplier
      const multHi = mulHi64(accMultiplierHi, accMultiplierLo, currMultiplierHi, currMultiplierLo)
      accMultiplierLo = Math.imul(accMultiplierLo, currMultiplierLo) >>> 0
      accMultiplierHi = multHi
      // accIncrement = accIncrement * currMultiplier + currIncrement
      const productHi = mulHi64(accIncrementHi, accIncrementLo, currMultiplierHi, currMultiplierLo)
      const sumLo = (Math.imul(accIncrementLo, currMultiplierLo) >>> 0) + currIncrementLo
      accIncrementHi = (productHi + currIncrementHi + (sumLo > 0xffffffff ? 1 : 0)) >>> 0
      accIncrementLo = sumLo >>> 0
    }
    // currIncrement = (currMultiplier + 1) * currIncrement, as a multiply-add
    const incrementHi = mulHi64(currMultiplierHi, currMultiplierLo, currIncrementHi, currIncrementLo)
    const incrementLo = (Math.imul(currMultiplierLo, currIncrementLo) >>> 0) + currIncrementLo
    currIncrementHi = (incrementHi + currIncrementHi + (incrementLo > 0xffffffff ? 1 : 0)) >>> 0
    currIncrementLo = incrementLo >>> 0
    // currMultiplier *= currMultiplier
    const squareHi = mulHi64(currMultiplierHi, currMultiplierLo, currMultiplierHi, currMultiplierLo)
    currMultiplierLo = Math.imul(currMultiplierLo, currMultiplierLo) >>> 0
    currMultiplierHi = squareHi

    remLo = ((remLo >>> 1) | ((remHi & 1) << 31)) >>> 0
    remHi = remHi >>> 1
  }

  const accMultiplier: Uint64 = { hi: accMultiplierHi, lo: accMultiplierLo }
  const accIncrement: Uint64 = { hi: accIncrementHi, lo: accIncrementLo }
  return affine(pcg, pcg.state.hi, pcg.state.lo, accMultiplier, accIncrement)
}

export const pcg32Advance = (pcg: PCGState, delta: number): PCGState => {
  if (delta === 1) return stepForward(pcg)
  if (delta === -1) return stepBack(pcg)
  return jump(pcg, delta)
}

// Seeds arrive as bigint, number or string. An integer-valued number is split
// into halves directly; everything else goes through BigInt, which also
// rejects fractional numbers and unparseable strings the way it always has.
const toUint64 = (value: bigint | number | string): Uint64 =>
  typeof value === 'number' && Number.isInteger(value) ? fromNumber(value) : fromBigInt(BigInt(value))

export const createPcg32 = (
  { streamScheme = pcgDefaultStreamScheme, outputFnType = pcgDefaultOutputFnType }: CreatePcgOptions,
  initState: bigint | number | string,
  initStreamId: bigint | number | string
): PCGState => {
  const resolvedScheme = resolveStreamScheme(streamScheme)
  const stream = toUint64(initStreamId)
  // The stream id is shifted up one bit and made odd, as pcg32 requires of its increment.
  const streamId: Uint64 = {
    hi: ((stream.hi << 1) | (stream.lo >>> 31)) >>> 0,
    lo: ((stream.lo << 1) | 1) >>> 0,
  }
  const seeded: PCGState = {
    state: add64(streamId, toUint64(initState)),
    streamId,
    variant: 'pcg32',
    outputFnType,
    streamScheme: resolvedScheme,
  }
  return stepForward(seeded)
}
