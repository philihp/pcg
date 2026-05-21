import { OutputFnType, StreamScheme } from './enums'

export { OutputFnType, StreamScheme }

export type OutputFn = (state: Uint64) => number

/** @deprecated Will be removed in 3.0.0. Use `keyof typeof StreamScheme` directly. */
export type StreamSchemeName = keyof typeof StreamScheme

// JSON-serializable representation of an unsigned 64-bit integer split into
// two unsigned 32-bit halves. `hi` is the upper 32 bits, `lo` is the lower.
export type Uint64 = {
  hi: number
  lo: number
}

export type SchemeFn = (pcg: PCGState) => Uint64

/** @deprecated Will be removed in 3.0.0. Use `bigint | number | string` directly. */
export type LongLike = bigint | number | string

// Reserved for future PCG variants (e.g. pcg64). Stored on every PCGState so
// serialized state from older versions remains forward-compatible when a new
// variant is introduced. `mulberry32` and `sfc32` are non-PCG generators that
// reuse the same state shape: mulberry32 packs into `state.lo`; sfc32 spreads
// its four 32-bit registers across `state` (a, b) and `streamId` (c, counter).
export type PCGVariant = 'pcg32' | 'mulberry32' | 'sfc32'

export type PCGState = {
  state: Uint64
  streamId: Uint64
  variant: PCGVariant
  outputFnType: OutputFnType
  streamScheme: StreamScheme
}

export type RandomFn<T> = (pcg: PCGState) => [T, PCGState]

export type CreatePcgOptions = {
  streamScheme?: StreamScheme | keyof typeof StreamScheme
  outputFnType?: OutputFnType
}

export interface RandomIntPartial1 {
  (max: number): (pcg: PCGState) => [number, PCGState]
  (max: number, pcg: PCGState): [number, PCGState]
}

export interface RandomListPartial1 {
  <T>(rng: RandomFn<T>): (initPcg: PCGState) => [T, PCGState][]
  <T>(rng: RandomFn<T>, initPcg: PCGState): [T, PCGState][]
}

