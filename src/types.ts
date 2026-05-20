export enum OutputFnType {
  XSH_RR = 0,
  XSH_RS = 1,
  XSL_RR = 2,
  // XSL_RR_RR = 3 // currently unstable
  RXS_M_XS = 4,
}

export type OutputFn = (state: Uint64) => number

// TODO: Implement more stream schemes

export enum StreamScheme {
  SETSEQ = 0,
  ONESEQ = 1,
  // UNIQUE = 2,
  MCG = 3,
}

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
