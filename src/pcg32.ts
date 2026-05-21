import { ror32 } from './bitwise'
import {
  pcgDefaultIncrement64,
  pcgDefaultMultiplier64,
  pcgDefaultOutputFnType,
  pcgDefaultStreamScheme,
} from './defaults'
import { OutputFnType, StreamScheme } from './enums'
import { CreatePcgOptions, OutputFn, PCGState, SchemeFn, Uint64 } from './types'
import { add64, fromBigInt, fromNumber, mul64 } from './uint64'

const MASK_64 = 0xffffffffffffffffn

const MULTIPLIER: Uint64 = fromBigInt(pcgDefaultMultiplier64)
const INCREMENT: Uint64 = fromBigInt(pcgDefaultIncrement64)
const ZERO_U64: Uint64 = { hi: 0, lo: 0 }
const ONE_U64: Uint64 = { hi: 0, lo: 1 }

const INCREMENTERS: Record<StreamScheme, SchemeFn> = {
  [StreamScheme.SETSEQ]: (pcg: PCGState) => pcg.streamId,
  [StreamScheme.ONESEQ]: () => INCREMENT,
  [StreamScheme.MCG]: () => ZERO_U64,
}

// 62169 fits in 17 bits, so its product with any 32-bit value stays below 2^49
// and is exact in IEEE-754. RXS_M_XS exploits this to skip the generic mul64.
const RXS_MULT = 62169

const OUTPUT_FNS: Record<OutputFnType, OutputFn> = {
  [OutputFnType.XSH_RR]: ({ hi, lo }: Uint64): number => {
    const rot = hi >>> 27
    const xorLo = (((lo >>> 18) | (hi << 14)) ^ lo) >>> 0
    const xorHi = (hi >>> 18) ^ hi
    const word = ((xorLo >>> 27) | (xorHi << 5)) >>> 0
    return ror32(rot, word)
  },
  [OutputFnType.XSH_RS]: ({ hi, lo }: Uint64): number => {
    const shift = (hi >>> 29) + 22
    const xorLo = (((lo >>> 22) | (hi << 10)) ^ lo) >>> 0
    const xorHi = ((hi >>> 22) ^ hi) >>> 0
    return ((xorLo >>> shift) | (xorHi << (32 - shift))) >>> 0
  },
  [OutputFnType.XSL_RR]: ({ hi, lo }: Uint64): number => ror32(hi >>> 27, (hi ^ lo) >>> 0),
  [OutputFnType.RXS_M_XS]: ({ hi, lo }: Uint64): number => {
    let aLo = ((lo >>> 13) | (hi << 19)) >>> 0
    let aHi = hi >>> 13
    const sumLo = aLo + 3
    aLo = sumLo >>> 0
    if (sumLo > 0xffffffff) aHi = (aHi + 1) >>> 0
    const xLo = (aLo ^ lo) >>> 0
    const xHi = (aHi ^ hi) >>> 0
    const mLo = xLo * RXS_MULT
    const mHi = xHi * RXS_MULT
    const wordLo = mLo >>> 0
    const carry = Math.floor(mLo / 0x100000000)
    const wordHi = (mHi + carry) >>> 0
    return (((wordLo >>> 11) | (wordHi << 21)) ^ wordLo) >>> 0
  },
}

const resolveStreamScheme = (streamScheme: StreamScheme | keyof typeof StreamScheme): StreamScheme => {
  const resolved: StreamScheme = typeof streamScheme === 'string' ? StreamScheme[streamScheme] : streamScheme
  if (resolved === undefined) throw new Error(`Unknown stream scheme: ${String(streamScheme)}`)
  return resolved
}

/* Multi-step advance (jump-ahead, jump-back)
 *
 * Brown, "Random Number Generation with Arbitrary Stride," Transactions of the American Nuclear
 * Society (Nov. 1994). Even though delta is unsigned in principle, passing a signed number works
 * by going "the long way round" via two's complement.
 */
export const pcg32Advance = (pcg: PCGState, delta: number): PCGState => {
  const increment = INCREMENTERS[pcg.streamScheme](pcg)
  if (delta === 1) return { ...pcg, state: add64(mul64(pcg.state, MULTIPLIER), increment) }

  let currMultiplier = MULTIPLIER
  let currIncrement = increment

  let accMultiplier: Uint64 = ONE_U64
  let accIncrement: Uint64 = ZERO_U64

  const remaining = fromNumber(delta)
  let remHi = remaining.hi
  let remLo = remaining.lo

  while (remHi !== 0 || remLo !== 0) {
    if ((remLo & 1) === 1) {
      accMultiplier = mul64(accMultiplier, currMultiplier)
      accIncrement = add64(mul64(accIncrement, currMultiplier), currIncrement)
    }
    currIncrement = mul64(add64(currMultiplier, ONE_U64), currIncrement)
    currMultiplier = mul64(currMultiplier, currMultiplier)

    remLo = ((remLo >>> 1) | ((remHi & 1) << 31)) >>> 0
    remHi = remHi >>> 1
  }

  return { ...pcg, state: add64(mul64(pcg.state, accMultiplier), accIncrement) }
}

export const pcg32Output = (pcg: PCGState): number => OUTPUT_FNS[pcg.outputFnType](pcg.state)

export const createPcg32 = (
  { streamScheme = pcgDefaultStreamScheme, outputFnType = pcgDefaultOutputFnType }: CreatePcgOptions,
  initState: bigint | number | string,
  initStreamId: bigint | number | string
): PCGState => {
  const resolvedScheme = resolveStreamScheme(streamScheme)
  const streamIdBig = (((BigInt(initStreamId) & MASK_64) << 1n) | 1n) & MASK_64
  const stateBig = (streamIdBig + BigInt(initState)) & MASK_64
  const seeded: PCGState = { state: fromBigInt(stateBig), streamId: fromBigInt(streamIdBig), variant: 'pcg32', outputFnType, streamScheme: resolvedScheme }
  return pcg32Advance(seeded, 1)
}
