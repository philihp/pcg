import { ror32 } from './bitwise'
import {
  pcgDefaultIncrement64,
  pcgDefaultMultiplier64,
  pcgDefaultOutputFnType,
  pcgDefaultStreamScheme,
} from './defaults'
import { mulberry32Advance, mulberry32Output } from './mulberry32'
import {
  CreatePcgOptions,
  OutputFn,
  OutputFnType,
  PCGState,
  RandomFn,
  SchemeFn,
  StreamScheme,
  Uint64,
} from './types'
import { add64, fromBigInt, fromNumber, mul64 } from './uint64'

export { createMulberry32 } from './mulberry32'
export { fromBigInt, toBigInt } from './uint64'

const MASK_64 = 0xffffffffffffffffn

const NUM_OUTPUT_BITS = 32

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
  if (resolved === undefined || INCREMENTERS[resolved] === undefined) {
    throw new Error(`Unknown stream scheme: ${String(streamScheme)}`)
  }
  return resolved
}

export const getOutput = (pcg: PCGState): number =>
  pcg.variant === 'mulberry32' ? mulberry32Output(pcg.state) : OUTPUT_FNS[pcg.outputFnType](pcg.state)

/* Multi-step advance functions (jump-ahead, jump-back)
 *
 * Brown, "Random Number Generation with Arbitrary Stride," Transactions of the American Nuclear
 * Society (Nov. 1994). Even though delta is unsigned in principle, passing a signed number works
 * by going "the long way round" via two's complement.
 */
const stepStateImpl = (delta: number, pcg: PCGState): PCGState => {
  if (pcg.variant === 'mulberry32') {
    return { ...pcg, state: mulberry32Advance(pcg.state, delta) }
  }
  let currMultiplier = MULTIPLIER
  let currIncrement = INCREMENTERS[pcg.streamScheme](pcg)

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

  return {
    ...pcg,
    state: add64(mul64(pcg.state, accMultiplier), accIncrement),
  }
}

export function stepState(delta: number): (pcg: PCGState) => PCGState
export function stepState(delta: number, pcg: PCGState): PCGState
export function stepState(delta: number, pcg?: PCGState): PCGState | ((pcg: PCGState) => PCGState) {
  if (pcg === undefined) return (p: PCGState) => stepStateImpl(delta, p)
  return stepStateImpl(delta, pcg)
}

// Fast path for delta=1, the common case driven by randomInt.
export const nextState = (pcg: PCGState): PCGState =>
  pcg.variant === 'mulberry32'
    ? { ...pcg, state: mulberry32Advance(pcg.state, 1) }
    : { ...pcg, state: add64(mul64(pcg.state, MULTIPLIER), INCREMENTERS[pcg.streamScheme](pcg)) }

export const prevState = stepState(-1)

const randomIntImpl = (min: number, max: number, pcg: PCGState): [number, PCGState] => {
  const outputMaxRange = 2 ** NUM_OUTPUT_BITS
  const bound = max - min
  if (bound < 0 || bound > outputMaxRange) throw new RangeError()

  const threshold = (outputMaxRange - bound) % bound
  const outputFn: OutputFn = pcg.variant === 'mulberry32' ? mulberry32Output : OUTPUT_FNS[pcg.outputFnType]

  let n: number
  let nextPcg = pcg
  do {
    n = outputFn(nextPcg.state)
    nextPcg = nextState(nextPcg)
  } while (n < threshold)

  return [(n % bound) + min, nextPcg]
}

interface RandomIntPartial1 {
  (max: number): (pcg: PCGState) => [number, PCGState]
  (max: number, pcg: PCGState): [number, PCGState]
}

export function randomInt(min: number, max: number, pcg: PCGState): [number, PCGState]
export function randomInt(min: number, max: number): (pcg: PCGState) => [number, PCGState]
export function randomInt(min: number): RandomIntPartial1
export function randomInt(min: number, max?: number, pcg?: PCGState): unknown {
  if (max === undefined) {
    return ((m: number, p?: PCGState) =>
      p === undefined ? (pp: PCGState) => randomIntImpl(min, m, pp) : randomIntImpl(min, m, p)) as RandomIntPartial1
  }
  if (pcg === undefined) return (p: PCGState) => randomIntImpl(min, max, p)
  return randomIntImpl(min, max, pcg)
}

const randomListImpl = <T>(length: number, rng: RandomFn<T>, initPcg: PCGState): [T, PCGState][] => {
  if (length <= 0) return []
  const result: [T, PCGState][] = new Array(length)
  let curr = rng(initPcg)
  result[0] = curr
  for (let i = 1; i < length; i++) {
    curr = rng(curr[1])
    result[i] = curr
  }
  return result
}

interface RandomListPartial1 {
  <T>(rng: RandomFn<T>): (initPcg: PCGState) => [T, PCGState][]
  <T>(rng: RandomFn<T>, initPcg: PCGState): [T, PCGState][]
}

interface RandomListFn {
  <T>(length: number, rng: RandomFn<T>, initPcg: PCGState): [T, PCGState][]
  <T>(length: number, rng: RandomFn<T>): (initPcg: PCGState) => [T, PCGState][]
  (length: number): RandomListPartial1
}

export const randomList: RandomListFn = ((length: number, rng?: RandomFn<unknown>, initPcg?: PCGState): unknown => {
  if (rng === undefined) {
    return (r: RandomFn<unknown>, p?: PCGState) =>
      p === undefined ? (pp: PCGState) => randomListImpl(length, r, pp) : randomListImpl(length, r, p)
  }
  if (initPcg === undefined) return (p: PCGState) => randomListImpl(length, rng, p)
  return randomListImpl(length, rng, initPcg)
}) as RandomListFn

export const createPcg = (
  { streamScheme = pcgDefaultStreamScheme, outputFnType = pcgDefaultOutputFnType }: CreatePcgOptions,
  initState: bigint | number | string,
  initStreamId: bigint | number | string
): PCGState => {
  const resolvedScheme = resolveStreamScheme(streamScheme)
  const streamIdBig = (((BigInt(initStreamId) & MASK_64) << 1n) | 1n) & MASK_64
  const stateBig = (streamIdBig + BigInt(initState)) & MASK_64
  return nextState({
    state: fromBigInt(stateBig),
    streamId: fromBigInt(streamIdBig),
    variant: 'pcg32',
    outputFnType,
    streamScheme: resolvedScheme,
  })
}

/** @deprecated Renamed to `createPcg`. This alias will be removed in 3.0.0. */
export const createPcg32 = createPcg
