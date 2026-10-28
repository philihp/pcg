import { createMulberry32, mulberry32Advance, mulberry32Output } from './mulberry32'
import { createPcg32, pcg32Advance, pcg32Output } from './pcg32'
import { createSfc32, sfc32Advance, sfc32Output } from './sfc32'
import type { PCGState, RandomFn } from './types'

const NUM_OUTPUT_BITS = 32
const OUTPUT_MAX_RANGE = 2 ** NUM_OUTPUT_BITS

// Alias kept for callers that adopted the 2.0.0 name; will be deprecated in a
// future release once the variant-suffixed factories settle as the convention.
export const createPcg = createPcg32

const unknownVariant = (variant: never): never => {
  throw new TypeError(`Unknown variant: ${String(variant)}`)
}

// Dispatch on the variant tag with a switch rather than a lookup table, so
// each call site reaches a known function that the engine can inline.
const advance = (pcg: PCGState, delta: number): PCGState => {
  switch (pcg.variant) {
    case 'pcg32':
      return pcg32Advance(pcg, delta)
    case 'mulberry32':
      return mulberry32Advance(pcg, delta)
    case 'sfc32':
      return sfc32Advance(pcg, delta)
    default:
      return unknownVariant(pcg.variant)
  }
}

const output = (pcg: PCGState): number => {
  switch (pcg.variant) {
    case 'pcg32':
      return pcg32Output(pcg)
    case 'mulberry32':
      return mulberry32Output(pcg)
    case 'sfc32':
      return sfc32Output(pcg)
    default:
      return unknownVariant(pcg.variant)
  }
}

export const getOutput = output

// Fast path for delta=1, the common case driven by randomInt.
export const nextState = (pcg: PCGState): PCGState => advance(pcg, 1)

const stepStateImpl = (delta: number, pcg: PCGState): PCGState => advance(pcg, delta)

export function stepState(delta: number): (pcg: PCGState) => PCGState
export function stepState(delta: number, pcg: PCGState): PCGState
export function stepState(delta: number, pcg?: PCGState): PCGState | ((pcg: PCGState) => PCGState) {
  if (pcg === undefined) return (p: PCGState) => stepStateImpl(delta, p)
  return stepStateImpl(delta, pcg)
}

export const prevState = stepState(-1)

// For an integer bound this equals n % bound, which V8 computes with a slow
// float modulo once n reaches 2^31. A non-integer bound keeps the float
// modulo, so its result stays exactly what it was.
const accept = (min: number, bound: number, n: number, nextPcg: PCGState): [number, PCGState] => [
  (Number.isInteger(bound) ? n - Math.floor(n / bound) * bound : n % bound) + min,
  nextPcg,
]

// A draw below the threshold is rejected and replaced by the next one. Fewer
// than half of all draws are rejected, so the recursion stays shallow.
const redraw = (min: number, bound: number, threshold: number, n: number, nextPcg: PCGState): [number, PCGState] =>
  n < threshold ? redraw(min, bound, threshold, output(nextPcg), advance(nextPcg, 1)) : accept(min, bound, n, nextPcg)

const randomIntImpl = (min: number, max: number, pcg: PCGState): [number, PCGState] => {
  const bound = max - min
  if (bound < 0 || bound > OUTPUT_MAX_RANGE) throw new RangeError()

  const n = output(pcg)
  const nextPcg = advance(pcg, 1)
  // Draws below 2^32 mod bound are rejected to keep the result unbiased. That
  // threshold is always below bound, so a draw of at least bound is accepted
  // without computing it; only a smaller draw pays for the modulo.
  return n < bound ? redraw(min, bound, (OUTPUT_MAX_RANGE - bound) % bound, n, nextPcg) : accept(min, bound, n, nextPcg)
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
  const result: [T, PCGState][] = Array.from({ length })
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

export { createMulberry32, createPcg32, createSfc32 }
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
