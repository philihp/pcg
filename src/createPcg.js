import Long from 'long';
import { curry, scan } from 'ramda';
import { pcgDefaultOutputFnType, pcgDefaultStreamScheme } from './defaults';
import { SETSEQ, ONESEQ, MCG } from './enums/StreamScheme';

/* Multi-step advance functions (jump-ahead, jump-back)
 *
 * The method used here is based on Brown, "Random Number Generation with Arbitrary Stride,",
 * Transactions of the American Nuclear Society (Nov. 1994). The algorithm is very similar to fast
 * exponentiation.
 *
 * Even though delta is an unsigned integer, we can pass a signed integer to go backwards, it just
 * goes "the long way round".
 */
const stepState = curry((delta, pcg) => {
  let currMultiplier = pcg.algorithm.multiplier;
  let currIncrement = {
    [SETSEQ]: () => pcg.streamId,
    [ONESEQ]: () => pcg.algorithm.increment,
    // TODO: [UNIQUE]: () => null,
    [MCG]: () => Long.fromInt(0, true),
  }[pcg.algorithm.streamScheme]();

  let accMultiplier = Long.fromInt(1, true);
  let accIncrement = Long.fromInt(0, true);

  for (
    let remainingDelta = Long.fromValue(delta).toUnsigned();
    remainingDelta.gt(0);
    remainingDelta = remainingDelta.shru(1)
  ) {
    if (remainingDelta.isOdd()) {
      accMultiplier = accMultiplier.mul(currMultiplier);
      accIncrement = accIncrement.mul(currMultiplier).add(currIncrement);
    }

    currIncrement = currMultiplier.add(1).mul(currIncrement);
    currMultiplier = currMultiplier.mul(currMultiplier);
  }

  return Object.assign(
    {},
    pcg,
    { state: pcg.state.mul(accMultiplier).add(accIncrement) },
  );
});

export const nextState = stepState(1);

export const prevState = stepState(-1);

export const randomInt = curry((min, max, pcg) => {
  const bound = max - min;
  if (bound < 0 || bound >= pcg.algorithm.outputMaxRange) throw new RangeError();

  const threshold = (pcg.algorithm.outputMaxRange - bound) % bound;

  // Uniformity guarantees that this loop will terminate
  let n;
  let nextPcg = pcg;
  do {
    n = nextPcg.getOutput();
    nextPcg = nextState(nextPcg);
  } while (n < threshold);

  return [(n % bound) + min, nextPcg];
});

export const randomList = curry((length, rng, pcg) =>
  scan(([, nextPcg]) => rng(nextPcg), rng(pcg), new Array(length - 1)),
);

export default curry(
  (
    { numOutputBits, multiplier, increment, outputFns },
    { streamScheme = pcgDefaultStreamScheme, outputFnType = pcgDefaultOutputFnType },
    initState,
    initStreamId,
  ) => {
    const streamId = Long.fromValue(initStreamId).toUnsigned().shl(1).or(1);

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
    });
  },
);
