import { pcgDefaultOutputFnType, pcgDefaultStreamScheme } from './defaults'
import { CreatePcg, CreatePcgOptions, LongLike, PCGConfig, PCGState, PCGVariant, RandomFn, Uint64 } from './types'

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

export const getOutput = (pcg: PCGState): number =>
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
const stepStateImpl = (delta: number, pcg: PCGState): PCGState => {
  const config = getConfig(pcg.variant)
  let currMultiplier = config.multiplier
  let currIncrement = config.getIncrement(pcg)

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

export function stepState(delta: number): (pcg: PCGState) => PCGState
export function stepState(delta: number, pcg: PCGState): PCGState
export function stepState(delta: number, pcg?: PCGState): PCGState | ((pcg: PCGState) => PCGState) {
  if (pcg === undefined) return (p: PCGState) => stepStateImpl(delta, p)
  return stepStateImpl(delta, pcg)
}

// Fast path for delta=1, which is the common case driven by randomInt.
// Equivalent to stepState(1) but avoids the jump-ahead bookkeeping loop.
export const nextState = (pcg: PCGState): PCGState => {
  const config = getConfig(pcg.variant)
  return {
    ...pcg,
    state: fromBigInt((toBigInt(pcg.state) * config.multiplier + config.getIncrement(pcg)) & MASK_64),
  }
}

export const prevState = stepState(-1)

const randomIntImpl = (min: number, max: number, pcg: PCGState): [number, PCGState] => {
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

export default (variant: PCGVariant, config: PCGConfig): CreatePcg => {
  variantConfigs[variant] = config
  return (
    { streamScheme = pcgDefaultStreamScheme, outputFnType = pcgDefaultOutputFnType }: CreatePcgOptions,
    initState: LongLike,
    initStreamId: LongLike
  ): PCGState => {
    const streamId = (((BigInt(initStreamId) & MASK_64) << 1n) | 1n) & MASK_64
    return nextState({
      state: fromBigInt((streamId + BigInt(initState)) & MASK_64),
      streamId: fromBigInt(streamId),
      variant,
      outputFnType,
      streamScheme,
    })
  }
}
