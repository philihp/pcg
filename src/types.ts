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
}

export type SchemeFn = () => bigint

export type LongLike = bigint | number | string

export type PCGConfig = {
  numOutputBits: number
  multiplier: bigint
  increment: bigint
  outputFns: Record<OutputFnType, OutputFn>
}

export type PCGState = {
  state: bigint
  streamId: bigint
  algorithm: {
    streamScheme: StreamScheme
    outputFnType: OutputFnType
    outputMaxRange: number
    multiplier: bigint
    increment: bigint
  }
  getOutput: OutputFn
}

export type RandomFn<T> = (pcg: PCGState) => [T, PCGState]

export type CreatePcgOptions = {
  streamScheme?: StreamScheme
  outputFnType?: OutputFnType
}

export type CreatePcg = (options: CreatePcgOptions, initState: LongLike, initStreamId: LongLike) => PCGState
