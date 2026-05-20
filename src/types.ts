export enum OutputFnType {
  XSH_RR = 0,
  XSH_RS = 1,
  XSL_RR = 2,
  // XSL_RR_RR = 3 // currently unstable
  RXS_M_XS = 4,
}

export type OutputFn = (state: bigint) => number

// TODO: Implement more stream schemes

export enum StreamScheme {
  SETSEQ = 0,
  ONESEQ = 1,
  // UNIQUE = 2,
  MCG = 3,
  MULBERRY32 = 4,
  SFC32 = 5,
}

export type StreamSchemeName = keyof typeof StreamScheme

export type SchemeFn = (pcg: PCGState) => bigint

// Some stream schemes are not LCG-based (e.g. MULBERRY32, SFC32). They
// override the entire step + output path with pure-number arithmetic, so the
// hot loop never touches BigInt after instantiation.
export type CustomRng = {
  // Build the initial PCGState from the seed inputs. The scheme decides how to
  // pack its internal state into PCGState's Uint64 slots.
  init: (initState: bigint, initStreamId: bigint, base: PCGState) => PCGState
  // Advance the state by one step.
  step: (pcg: PCGState) => PCGState
  // Read the current 32-bit output from the state.
  output: (pcg: PCGState) => number
  // Optional analytical jump-ahead. When absent, stepState falls back to a
  // brute-force loop of `step` (and disallows negative deltas).
  jump?: (delta: number, pcg: PCGState) => PCGState
}

export type LongLike = bigint | number | string

// JSON-serializable representation of an unsigned 64-bit integer split into
// two unsigned 32-bit halves. `hi` is the upper 32 bits, `lo` is the lower.
export type Uint64 = {
  hi: number
  lo: number
}

export type PCGVariant = 'pcg32'

export type PCGState = {
  state: Uint64
  streamId: Uint64
  variant: PCGVariant
  outputFnType: OutputFnType
  streamScheme: StreamScheme
}

export type PCGConfig = {
  numOutputBits: number
  multiplier: bigint
  increment: bigint
  outputFns: Record<OutputFnType, OutputFn>
  incrementers: Partial<Record<StreamScheme, SchemeFn>>
  customRngs?: Partial<Record<StreamScheme, CustomRng>>
}

export type RandomFn<T> = (pcg: PCGState) => [T, PCGState]

export type CreatePcgOptions = {
  streamScheme?: StreamScheme | StreamSchemeName
  outputFnType?: OutputFnType
}

export type CreatePcg = (options: CreatePcgOptions, initState: LongLike, initStreamId: LongLike) => PCGState
