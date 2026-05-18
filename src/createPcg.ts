import { curry } from 'ramda'
import { pcgDefaultOutputFnType, pcgDefaultStreamScheme } from './defaults'
import { CreatePcg, CreatePcgOptions, LongLike, PCGConfig, PCGState, RandomFn, SchemeFn, StreamScheme } from './types'

const MASK_64 = 0xffffffffffffffffn

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
    [StreamScheme.MCG]: () => 0n,
  }

  let currIncrement = incrementers[pcg.algorithm.streamScheme]()

  let accMultiplier = 1n
  let accIncrement = 0n

  for (let remainingDelta = BigInt(delta) & MASK_64; remainingDelta > 0n; remainingDelta >>= 1n) {
    if ((remainingDelta & 1n) === 1n) {
      accMultiplier = (accMultiplier * currMultiplier) & MASK_64
      accIncrement = (accIncrement * currMultiplier + currIncrement) & MASK_64
    }

    currIncrement = ((currMultiplier + 1n) * currIncrement) & MASK_64
    currMultiplier = (currMultiplier * currMultiplier) & MASK_64
  }

  return {
    ...pcg,
    state: (pcg.state * accMultiplier + accIncrement) & MASK_64,
  }
})

// Fast path for delta=1, which is the common case driven by randomInt.
// Equivalent to stepState(1) but avoids the curry trampoline and the
// jump-ahead bookkeeping loop.
export const nextState = (pcg: PCGState): PCGState => {
  const scheme = pcg.algorithm.streamScheme
  const increment =
    scheme === StreamScheme.SETSEQ
      ? pcg.streamId
      : scheme === StreamScheme.ONESEQ
        ? pcg.algorithm.increment
        : 0n
  return {
    ...pcg,
    state: (pcg.state * pcg.algorithm.multiplier + increment) & MASK_64,
  }
}

export const prevState = stepState(-1)

export const randomInt = curry((min: number, max: number, pcg: PCGState): [number, PCGState] => {
  const bound = max - min
  if (bound < 0 || bound >= pcg.algorithm.outputMaxRange) throw new RangeError()

  const threshold = (pcg.algorithm.outputMaxRange - bound) % bound
  const getOutput = pcg.getOutput

  let n: number
  let nextPcg = pcg
  do {
    n = getOutput(nextPcg.state)
    nextPcg = nextState(nextPcg)
  } while (n < threshold)

  return [(n % bound) + min, nextPcg]
})

// Manually-typed curried overloads — ramda's Curry<> helper erases generics.
interface RandomListFn {
  <T>(length: number, rng: RandomFn<T>, initPcg: PCGState): [T, PCGState][]
  <T>(length: number, rng: RandomFn<T>): (initPcg: PCGState) => [T, PCGState][]
  <T>(length: number): (rng: RandomFn<T>, initPcg: PCGState) => [T, PCGState][]
}

export const randomList: RandomListFn = curry(<T>(length: number, rng: RandomFn<T>, initPcg: PCGState): [T, PCGState][] => {
  if (length <= 0) return []
  const result: [T, PCGState][] = new Array(length)
  let curr = rng(initPcg)
  result[0] = curr
  for (let i = 1; i < length; i++) {
    curr = rng(curr[1])
    result[i] = curr
  }
  return result
}) as RandomListFn

export default ({ numOutputBits, multiplier, increment, outputFns }: PCGConfig): CreatePcg =>
  (
    { streamScheme = pcgDefaultStreamScheme, outputFnType = pcgDefaultOutputFnType }: CreatePcgOptions,
    initState: LongLike,
    initStreamId: LongLike
  ): PCGState => {
    const streamId = (((BigInt(initStreamId) & MASK_64) << 1n) | 1n) & MASK_64

    return nextState({
      state: (streamId + BigInt(initState)) & MASK_64,
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
