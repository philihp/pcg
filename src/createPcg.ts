import { pcgDefaultOutputFnType, pcgDefaultStreamScheme } from './defaults'
import {
  CreatePcg64,
  CreatePcgOptions,
  LongLike,
  PCGConfig,
  PCGState32,
  PCGState64,
  PCGVariant,
  RandomFn,
  RandomFn64,
  StreamScheme,
  Uint64,
} from './types'
import { mul64, mulAdd64, numberToU64 } from './uint64'

const MASK_32 = 0xffffffffn
const MASK_64 = 0xffffffffffffffffn

// ---------------------------------------------------------------------------
// PCG32: BigInt-free default. Opinionated on the configuration:
//   - Stream scheme: SETSEQ (one stream per streamId)
//   - Output function: XSH_RR
// For different schemes or output functions, use the BigInt-backed
// `createPcg64` API below. Seeds are plain JS numbers (32-bit unsigned
// range); PCG32 must never touch BigInt — that is reserved for the 64-bit
// API.
// ---------------------------------------------------------------------------

// 6364136223846793005 = 0x5851F42D4C957F2D
const MUL_HI = 0x5851f42d
const MUL_LO = 0x4c957f2d

const setseqIncrement = (initStreamId: number): { hi: number; lo: number } => {
  // streamId = ((id << 1) | 1) mod 2^64
  const u = numberToU64(initStreamId)
  const hi = ((u.hi << 1) | (u.lo >>> 31)) >>> 0
  const lo = ((u.lo << 1) | 1) >>> 0
  return { hi, lo }
}

export const createPcg32 = (initState: number, initStreamId: number): PCGState32 => {
  const inc = setseqIncrement(initStreamId)

  // state = nextState((streamId + initState) mod 2^64)
  const s = numberToU64(initState)
  const sumLo = inc.lo + s.lo
  const carry = sumLo > 0xffffffff ? 1 : 0
  const seedHi = (inc.hi + s.hi + carry) >>> 0
  const seedLo = sumLo >>> 0

  const next = mulAdd64(seedHi, seedLo, MUL_HI, MUL_LO, inc.hi, inc.lo)
  return { sHi: next.hi, sLo: next.lo, iHi: inc.hi, iLo: inc.lo }
}

export const nextState = (pcg: PCGState32): PCGState32 => {
  // Inlined mulAdd64 with constant multiplier to avoid splitting it every call.
  const sHi = pcg.sHi
  const sLo = pcg.sLo
  const iHi = pcg.iHi
  const iLo = pcg.iLo

  const a0 = sLo & 0xffff
  const a1 = sLo >>> 16
  const a2 = sHi & 0xffff
  const a3 = sHi >>> 16

  const c0 = a0 * 0x7f2d + (iLo & 0xffff)
  let c1 = (c0 >>> 16) + a1 * 0x7f2d + (iLo >>> 16)
  let c2 = c1 >>> 16
  c1 = (c1 & 0xffff) + a0 * 0x4c95
  c2 += c1 >>> 16
  let c3 = c2 >>> 16
  c2 = (c2 & 0xffff) + a2 * 0x7f2d + (iHi & 0xffff)
  c3 += c2 >>> 16
  c2 = (c2 & 0xffff) + a1 * 0x4c95
  c3 += c2 >>> 16
  c2 = (c2 & 0xffff) + a0 * 0xf42d
  c3 += c2 >>> 16
  c3 = (c3 & 0xffff) + a3 * 0x7f2d + a2 * 0x4c95 + a1 * 0xf42d + a0 * 0x5851 + (iHi >>> 16)

  return {
    sHi: (((c3 & 0xffff) << 16) | (c2 & 0xffff)) >>> 0,
    sLo: (((c1 & 0xffff) << 16) | (c0 & 0xffff)) >>> 0,
    iHi,
    iLo,
  }
}

// XSH_RR output.
export const getOutput = (pcg: PCGState32): number => {
  const h = pcg.sHi
  const l = pcg.sLo
  const rot = h >>> 27
  const xh = ((h >>> 18) ^ h) >>> 0
  const xl = ((((h << 14) | (l >>> 18)) >>> 0) ^ l) >>> 0
  const val = ((xh << 5) | (xl >>> 27)) >>> 0
  return ((val >>> rot) | (val << (-rot & 31))) >>> 0
}

export const randomInt = (min: number, max: number, pcg: PCGState32): [number, PCGState32] => {
  const bound = max - min
  if (bound < 0 || bound > 0x100000000) throw new RangeError()
  const threshold = (0x100000000 - bound) % bound

  let curr = pcg
  let n: number
  do {
    n = getOutput(curr)
    curr = nextState(curr)
  } while (n < threshold)
  return [(n % bound) + min, curr]
}

// Convenience: full 32-bit unsigned range, no rejection sampling required.
export const randomUint32 = (pcg: PCGState32): [number, PCGState32] => [getOutput(pcg), nextState(pcg)]

export const randomList = <T>(length: number, rng: RandomFn<T>, initPcg: PCGState32): [T, PCGState32][] => {
  if (length <= 0) return []
  const result: [T, PCGState32][] = new Array(length)
  let curr = rng(initPcg)
  result[0] = curr
  for (let i = 1; i < length; i++) {
    curr = rng(curr[1])
    result[i] = curr
  }
  return result
}

// Multi-step advance via Brown (1994), translated to {hi, lo} math.
export const stepState = (delta: number, pcg: PCGState32): PCGState32 => {
  let currMulHi = MUL_HI
  let currMulLo = MUL_LO
  let currIncHi = pcg.iHi
  let currIncLo = pcg.iLo

  let accMulHi = 0
  let accMulLo = 1
  let accIncHi = 0
  let accIncLo = 0

  const d = numberToU64(delta)
  let dHi = d.hi
  let dLo = d.lo

  while (dHi !== 0 || dLo !== 0) {
    if ((dLo & 1) === 1) {
      const am = mul64(accMulHi, accMulLo, currMulHi, currMulLo)
      accMulHi = am.hi
      accMulLo = am.lo

      const ai = mulAdd64(accIncHi, accIncLo, currMulHi, currMulLo, currIncHi, currIncLo)
      accIncHi = ai.hi
      accIncLo = ai.lo
    }

    const mp1Lo = (currMulLo + 1) >>> 0
    const mp1Hi = currMulLo === 0xffffffff ? ((currMulHi + 1) >>> 0) : currMulHi
    const ci = mul64(currIncHi, currIncLo, mp1Hi, mp1Lo)
    currIncHi = ci.hi
    currIncLo = ci.lo

    const cm = mul64(currMulHi, currMulLo, currMulHi, currMulLo)
    currMulHi = cm.hi
    currMulLo = cm.lo

    dLo = ((dLo >>> 1) | ((dHi & 1) << 31)) >>> 0
    dHi = dHi >>> 1
  }

  const r = mulAdd64(pcg.sHi, pcg.sLo, accMulHi, accMulLo, accIncHi, accIncLo)
  return { sHi: r.hi, sLo: r.lo, iHi: pcg.iHi, iLo: pcg.iLo }
}

export const prevState = (pcg: PCGState32): PCGState32 => stepState(-1, pcg)

// ---------------------------------------------------------------------------
// PCG64: BigInt-backed factory. Supports non-default stream schemes
// (ONESEQ, MCG) and output functions (XSH_RS, XSL_RR, RXS_M_XS) at the cost
// of BigInt arithmetic per step.
// ---------------------------------------------------------------------------

export const toBigInt = ({ hi, lo }: Uint64): bigint => (BigInt(hi) << 32n) | BigInt(lo)

export const fromBigInt = (value: bigint): Uint64 => ({
  hi: Number((value >> 32n) & MASK_32),
  lo: Number(value & MASK_32),
})

const variantConfigs: Partial<Record<PCGVariant, PCGConfig>> = {}

const getConfig = (variant: PCGVariant): PCGConfig => {
  const config = variantConfigs[variant]
  if (config === undefined) throw new Error(`Unknown PCG variant: ${String(variant)}`)
  return config
}

const resolveStreamScheme = (
  streamScheme: StreamScheme | keyof typeof StreamScheme,
  config: PCGConfig
): StreamScheme => {
  const resolved: StreamScheme = typeof streamScheme === 'string' ? StreamScheme[streamScheme] : streamScheme
  if (resolved === undefined || config.incrementers[resolved] === undefined) {
    throw new Error(`Unknown stream scheme: ${String(streamScheme)}`)
  }
  return resolved
}

export const getOutput64 = (pcg: PCGState64): number =>
  getConfig(pcg.variant).outputFns[pcg.outputFnType](toBigInt(pcg.state))

/* Multi-step advance functions (jump-ahead, jump-back)
 *
 * The method used here is based on Brown, "Random Number Generation with Arbitrary Stride,",
 * Transactions of the American Nuclear Society (Nov. 1994). The algorithm is very similar to fast
 * exponentiation.
 *
 * Even though delta is an unsigned integer, we can pass a signed integer to go backwards, it just
 * goes "the long way round".
 */
const stepState64Impl = (delta: number, pcg: PCGState64): PCGState64 => {
  const config = getConfig(pcg.variant)
  let currMultiplier = config.multiplier
  let currIncrement = config.incrementers[pcg.streamScheme](pcg)

  let accMultiplier = 1n
  let accIncrement = 0n

  for (let remainingDelta = BigInt(delta) & MASK_64; remainingDelta > 0n; remainingDelta >>= 1n) {
    if ((remainingDelta & 1n) === 1n) {
      accMultiplier = (accMultiplier * currMultiplier) & MASK_64
      accIncrement = (accIncrement * currMultiplier + currIncrement) & MASK_64
    }

    currIncrement = ((currMultiplier + 1n) * currIncrement) & MASK_64
    currMultiplier = (currMultiplier * currMultiplier) & MASK_64
  }

  return {
    ...pcg,
    state: fromBigInt((toBigInt(pcg.state) * accMultiplier + accIncrement) & MASK_64),
  }
}

export function stepState64(delta: number): (pcg: PCGState64) => PCGState64
export function stepState64(delta: number, pcg: PCGState64): PCGState64
export function stepState64(delta: number, pcg?: PCGState64): PCGState64 | ((pcg: PCGState64) => PCGState64) {
  if (pcg === undefined) return (p: PCGState64) => stepState64Impl(delta, p)
  return stepState64Impl(delta, pcg)
}

// Fast path for delta=1, which is the common case driven by randomInt64.
// Equivalent to stepState64(1) but avoids the jump-ahead bookkeeping loop.
export const nextState64 = (pcg: PCGState64): PCGState64 => {
  const config = getConfig(pcg.variant)
  return {
    ...pcg,
    state: fromBigInt((toBigInt(pcg.state) * config.multiplier + config.incrementers[pcg.streamScheme](pcg)) & MASK_64),
  }
}

export const prevState64 = stepState64(-1)

const randomInt64Impl = (min: number, max: number, pcg: PCGState64): [number, PCGState64] => {
  const config = getConfig(pcg.variant)
  const outputMaxRange = 2 ** config.numOutputBits
  const bound = max - min
  if (bound < 0 || bound > outputMaxRange) throw new RangeError()

  const threshold = (outputMaxRange - bound) % bound
  const outputFn = config.outputFns[pcg.outputFnType]

  let n: number
  let nextPcg = pcg
  do {
    n = outputFn(toBigInt(nextPcg.state))
    nextPcg = nextState64(nextPcg)
  } while (n < threshold)

  return [(n % bound) + min, nextPcg]
}

interface RandomInt64Partial1 {
  (max: number): (pcg: PCGState64) => [number, PCGState64]
  (max: number, pcg: PCGState64): [number, PCGState64]
}

export function randomInt64(min: number, max: number, pcg: PCGState64): [number, PCGState64]
export function randomInt64(min: number, max: number): (pcg: PCGState64) => [number, PCGState64]
export function randomInt64(min: number): RandomInt64Partial1
export function randomInt64(min: number, max?: number, pcg?: PCGState64): unknown {
  if (max === undefined) {
    return ((m: number, p?: PCGState64) =>
      p === undefined
        ? (pp: PCGState64) => randomInt64Impl(min, m, pp)
        : randomInt64Impl(min, m, p)) as RandomInt64Partial1
  }
  if (pcg === undefined) return (p: PCGState64) => randomInt64Impl(min, max, p)
  return randomInt64Impl(min, max, pcg)
}

const randomList64Impl = <T>(length: number, rng: RandomFn64<T>, initPcg: PCGState64): [T, PCGState64][] => {
  if (length <= 0) return []
  const result: [T, PCGState64][] = new Array(length)
  let curr = rng(initPcg)
  result[0] = curr
  for (let i = 1; i < length; i++) {
    curr = rng(curr[1])
    result[i] = curr
  }
  return result
}

interface RandomList64Partial1 {
  <T>(rng: RandomFn64<T>): (initPcg: PCGState64) => [T, PCGState64][]
  <T>(rng: RandomFn64<T>, initPcg: PCGState64): [T, PCGState64][]
}

interface RandomList64Fn {
  <T>(length: number, rng: RandomFn64<T>, initPcg: PCGState64): [T, PCGState64][]
  <T>(length: number, rng: RandomFn64<T>): (initPcg: PCGState64) => [T, PCGState64][]
  (length: number): RandomList64Partial1
}

export const randomList64: RandomList64Fn = ((
  length: number,
  rng?: RandomFn64<unknown>,
  initPcg?: PCGState64
): unknown => {
  if (rng === undefined) {
    return (r: RandomFn64<unknown>, p?: PCGState64) =>
      p === undefined ? (pp: PCGState64) => randomList64Impl(length, r, pp) : randomList64Impl(length, r, p)
  }
  if (initPcg === undefined) return (p: PCGState64) => randomList64Impl(length, rng, p)
  return randomList64Impl(length, rng, initPcg)
}) as RandomList64Fn

export default (variant: PCGVariant, config: PCGConfig): CreatePcg64 => {
  variantConfigs[variant] = config
  return (
    { streamScheme = pcgDefaultStreamScheme, outputFnType = pcgDefaultOutputFnType }: CreatePcgOptions,
    initState: LongLike,
    initStreamId: LongLike
  ): PCGState64 => {
    const resolvedScheme = resolveStreamScheme(streamScheme, config)
    const streamId = (((BigInt(initStreamId) & MASK_64) << 1n) | 1n) & MASK_64
    return nextState64({
      state: fromBigInt((streamId + BigInt(initState)) & MASK_64),
      streamId: fromBigInt(streamId),
      variant,
      outputFnType,
      streamScheme: resolvedScheme,
    })
  }
}
