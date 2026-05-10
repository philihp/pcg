import Long from 'long'

export enum OutputFnType {
  XSH_RR = 0,
  XSH_RS = 1,
  XSL_RR = 2,
  // XSL_RR_RR = 3 // currently unstable
  RXS_M_XS = 4,
}

export type OutputFn = (state: Long) => number

// TODO: Implement more stream schemes

export enum StreamScheme {
  SETSEQ = 0,
  ONESEQ = 1,
  // UNIQUE = 2,
  MCG = 3,
}

export type SchemeFn = () => Long

export type LongLike = Long | number | bigint | string | { low: number; high: number; unsigned: boolean }

export type PCGConfig = {
  numOutputBits: number
  multiplier: Long
  increment: Long
  outputFns: Record<OutputFnType, OutputFn>
}

export type PCGState = {
  state: Long
  streamId: Long
  algorithm: {
    streamScheme: StreamScheme
    outputFnType: OutputFnType
    outputMaxRange: number
    multiplier: Long
    increment: Long
  }
  getOutput: OutputFn
}

export type RandomFn<T> = (pcg: PCGState) => [T, PCGState]

export type CreatePcgOptions = {
  streamScheme?: StreamScheme
  outputFnType?: OutputFnType
}

export type CreatePcg = (options: CreatePcgOptions, initState: LongLike, initStreamId: LongLike) => PCGState
