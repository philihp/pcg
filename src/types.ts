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
  incrementers: Record<StreamScheme, SchemeFn>
}

export type RandomFn<T> = (pcg: PCGState) => [T, PCGState]

export type CreatePcgOptions = {
  streamScheme?: StreamScheme | StreamSchemeName
  outputFnType?: OutputFnType
}

export type CreatePcg = (options: CreatePcgOptions, initState: LongLike, initStreamId: LongLike) => PCGState
