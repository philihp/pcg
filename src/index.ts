import { pcgDefaultOutputFnType, pcgDefaultStreamScheme } from './defaults'
import { createMulberry32, mulberry32Advance, mulberry32Output } from './mulberry32'
import { pcg32Advance, pcg32Output, resolveStreamScheme } from './pcg32'
import { CreatePcgOptions, PCGState, PCGVariant, RandomFn, Uint64 } from './types'
import { fromBigInt } from './uint64'

const NUM_OUTPUT_BITS = 32
const MASK_64 = 0xffffffffffffffffn

export const createPcg = (
  { streamScheme = pcgDefaultStreamScheme, outputFnType = pcgDefaultOutputFnType }: CreatePcgOptions,
  initState: bigint | number | string,
  initStreamId: bigint | number | string
): PCGState => {
  const resolvedScheme = resolveStreamScheme(streamScheme)
  const streamIdBig = (((BigInt(initStreamId) & MASK_64) << 1n) | 1n) & MASK_64
  const stateBig = (streamIdBig + BigInt(initState)) & MASK_64
  const seeded: PCGState = {
    state: fromBigInt(stateBig),
    streamId: fromBigInt(streamIdBig),
    variant: 'pcg32',
    outputFnType,
    streamScheme: resolvedScheme,
  }
  return { ...seeded, state: pcg32Advance(seeded, 1) }
}

/** @deprecated Renamed to `createPcg`. This alias will be removed in 3.0.0. */
export const createPcg32 = createPcg

type VariantImpl = {
  advance: (pcg: PCGState, delta: number) => Uint64
  output: (pcg: PCGState) => number
}

const VARIANTS: Record<PCGVariant, VariantImpl> = {
  pcg32: { advance: pcg32Advance, output: pcg32Output },
  mulberry32: { advance: mulberry32Advance, output: mulberry32Output },
}

const advance = (pcg: PCGState, delta: number): Uint64 => VARIANTS[pcg.variant].advance(pcg, delta)

const output = (pcg: PCGState): number => VARIANTS[pcg.variant].output(pcg)

export const getOutput = output

// Fast path for delta=1, the common case driven by randomInt.
export const nextState = (pcg: PCGState): PCGState => ({ ...pcg, state: advance(pcg, 1) })

const stepStateImpl = (delta: number, pcg: PCGState): PCGState => ({ ...pcg, state: advance(pcg, delta) })

export function stepState(delta: number): (pcg: PCGState) => PCGState
export function stepState(delta: number, pcg: PCGState): PCGState
export function stepState(delta: number, pcg?: PCGState): PCGState | ((pcg: PCGState) => PCGState) {
  if (pcg === undefined) return (p: PCGState) => stepStateImpl(delta, p)
  return stepStateImpl(delta, pcg)
}

export const prevState = stepState(-1)

const randomIntImpl = (min: number, max: number, pcg: PCGState): [number, PCGState] => {
  const outputMaxRange = 2 ** NUM_OUTPUT_BITS
  const bound = max - min
  if (bound < 0 || bound > outputMaxRange) throw new RangeError()

  const threshold = (outputMaxRange - bound) % bound

  let n: number
  let nextPcg = pcg
  do {
    n = output(nextPcg)
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

export { createMulberry32 }
export { fromBigInt, toBigInt } from './uint64'
export { OutputFnType, StreamScheme } from './types'
export type {
  CreatePcgOptions,
  LongLike,
  OutputFn,
  PCGState,
  PCGVariant,
  RandomFn,
  SchemeFn,
  StreamSchemeName,
  Uint64,
} from './types'
