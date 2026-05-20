import { ror32 } from './bitwise'
import { pcgDefaultIncrement64, pcgDefaultMultiplier64 } from './defaults'
import { OutputFnType, PCGState64, StreamScheme } from './types'
import createPcg, { toBigInt } from './createPcg'

export {
  stepState64,
  nextState64,
  prevState64,
  randomInt64,
  randomList64,
  getOutput64,
  toBigInt,
  fromBigInt,
} from './createPcg'
export {
  createPcg32,
  nextState,
  prevState,
  stepState,
  getOutput,
  randomInt,
  randomUint32,
  randomList,
} from './pcg32'
export type { PCGState32, RandomFn } from './pcg32'
export { OutputFnType, StreamScheme } from './types'
export type {
  CreatePcg64,
  CreatePcgOptions,
  LongLike,
  OutputFn,
  PCGConfig,
  PCGState64,
  PCGVariant,
  RandomFn64,
  SchemeFn,
  StreamSchemeName,
  Uint64,
} from './types'

const MASK_32 = 0xffffffffn
const MASK_64 = 0xffffffffffffffffn

export const createPcg64 = createPcg('pcg32', {
  numOutputBits: 32,
  multiplier: pcgDefaultMultiplier64,
  increment: pcgDefaultIncrement64,
  incrementers: {
    [StreamScheme.SETSEQ]: (pcg: PCGState64) => toBigInt(pcg.streamId),
    [StreamScheme.ONESEQ]: () => pcgDefaultIncrement64,
    [StreamScheme.MCG]: () => 0n,
  },
  outputFns: {
    [OutputFnType.XSH_RR]: (state: bigint): number =>
      ror32(Number(state >> 59n), Number((((state >> 18n) ^ state) >> 27n) & MASK_32)),
    [OutputFnType.XSH_RS]: (state: bigint): number =>
      Number((((state >> 22n) ^ state) >> ((state >> 61n) + 22n)) & MASK_32),
    [OutputFnType.XSL_RR]: (state: bigint): number =>
      ror32(Number(state >> 59n), Number(((state >> 32n) ^ state) & MASK_32)),
    // [OutputFnType.XSL_RR_RR]: see git history for the original Long-based draft.
    [OutputFnType.RXS_M_XS]: (state: bigint): number => {
      const word = ((((state >> 13n) + 3n) ^ state) * 62169n) & MASK_64
      return Number(((word >> 11n) ^ word) & MASK_32)
    },
  },
})
