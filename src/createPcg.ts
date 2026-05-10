import Long from 'long'
import { curry, scan } from 'ramda'
import { pcgDefaultOutputFnType, pcgDefaultStreamScheme } from './defaults'
import { OutputFnType, PCGConfig, PCGState, SchemeFn, StreamScheme } from './types'

/* Multi-step advance functions (jump-ahead, jump-back)
 *
 * The method used here is based on Brown, "Random Number Generation with Arbitrary Stride,",
 * Transactions of the American Nuclear Society (Nov. 1994). The algorithm is very similar to fast
 * exponentiation.
 *
 * Even though delta is an unsigned integer, we can pass a signed integer to go backwards, it just
 * goes "the long way round".
 */
export const stepState = curry((delta: number, pcg: PCGState): PCGState => {
  let currMultiplier = pcg.algorithm.multiplier
  const incrementers: Record<StreamScheme, SchemeFn> = {
    [StreamScheme.SETSEQ]: () => pcg.streamId,
    [StreamScheme.ONESEQ]: () => pcg.algorithm.increment,
    // TODO: [StreamScheme.UNIQUE]: () => null,
    [StreamScheme.MCG]: () => Long.fromInt(0, true),
  }

  let currIncrement = incrementers[pcg.algorithm.streamScheme]()

  let accMultiplier = Long.fromInt(1, true)
  let accIncrement = Long.fromInt(0, true)

  for (
    let remainingDelta = Long.fromValue(delta).toUnsigned();
    remainingDelta.gt(0);
    remainingDelta = remainingDelta.shru(1)
  ) {
    if (remainingDelta.isOdd()) {
      accMultiplier = accMultiplier.mul(currMultiplier)
      accIncrement = accIncrement.mul(currMultiplier).add(currIncrement)
    }

    currIncrement = currMultiplier.add(1).mul(currIncrement)
    currMultiplier = currMultiplier.mul(currMultiplier)
  }

  return {
    ...pcg,
    state: pcg.state.mul(accMultiplier).add(accIncrement),
  }
})

export const nextState = stepState(1)

export const prevState = stepState(-1)

export const randomInt = curry((min: number, max: number, pcg: PCGState): [number, PCGState] => {
  const bound = max - min
  if (bound < 0 || bound >= pcg.algorithm.outputMaxRange) throw new RangeError()

  const threshold = (pcg.algorithm.outputMaxRange - bound) % bound

  // Uniformity guarantees that this loop will terminate
  let n: Long
  let nextPcg = pcg
  do {
    n = Long.fromValue(pcg.getOutput(nextPcg.state))
    nextPcg = nextState(nextPcg)
  } while (n.lt(threshold))

  return [n.mod(bound).add(min).toNumber(), nextPcg]
})

export type RandomFn<T> = (pcg: PCGState) => [T, PCGState]

interface RandomListFn {
  <T>(length: number, rng: RandomFn<T>, initPcg: PCGState): [T, PCGState][]
  <T>(length: number, rng: RandomFn<T>): (initPcg: PCGState) => [T, PCGState][]
  <T>(length: number): (rng: RandomFn<T>, initPcg: PCGState) => [T, PCGState][]
  <T>(length: number): (rng: RandomFn<T>) => (initPcg: PCGState) => [T, PCGState][]
}

export const randomList: RandomListFn = curry(
  <T>(length: number, rng: RandomFn<T>, initPcg: PCGState): [T, PCGState][] =>
    scan(([, lastPcg]) => rng(lastPcg), rng(initPcg), new Array(length - 1))
) as RandomListFn

export type LongLike = Long | number | bigint | string | { low: number; high: number; unsigned: boolean }

export type CreatePcgOptions = {
  streamScheme?: StreamScheme
  outputFnType?: OutputFnType
}

export type CreatePcg = (options: CreatePcgOptions, initState: LongLike, initStreamId: LongLike) => PCGState

export default ({ numOutputBits, multiplier, increment, outputFns }: PCGConfig): CreatePcg =>
  (
    { streamScheme = pcgDefaultStreamScheme, outputFnType = pcgDefaultOutputFnType }: CreatePcgOptions,
    initState: LongLike,
    initStreamId: LongLike
  ): PCGState => {
    const streamId = Long.fromValue(initStreamId).toUnsigned().shl(1).or(1)

    return nextState({
      state: streamId.add(initState),
      streamId,
      algorithm: {
        streamScheme,
        outputFnType,
        outputMaxRange: 2 ** numOutputBits,
        multiplier,
        increment,
      },
      getOutput: outputFns[outputFnType],
    })
  }
