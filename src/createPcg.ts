import { pcgDefaultOutputFnType, pcgDefaultStreamScheme } from './defaults'
import {
  CreatePcg64,
  CreatePcgOptions,
  LongLike,
  PCGConfig,
  PCGState64,
  PCGVariant,
  RandomFn64,
  StreamScheme,
  Uint64,
} from './types'

const MASK_32 = 0xffffffffn
const MASK_64 = 0xffffffffffffffffn

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
