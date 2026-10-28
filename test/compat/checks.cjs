// A fingerprint of every public function's output, in plain JavaScript with
// no dependencies, so the built package can be checked on old Node versions
// that the toolchain itself cannot run on.

const fingerprint = (pcg) => {
  const {
    OutputFnType,
    StreamScheme,
    createMulberry32,
    createPcg,
    createPcg32,
    createSfc32,
    fromBigInt,
    getOutput,
    nextState,
    prevState,
    randomInt,
    randomList,
    stepState,
    toBigInt,
  } = pcg

  // `count` draws of randomInt(min, max) chained from `start`
  const draws = (min, max, start, count) =>
    Array.from({ length: count }).reduce(
      ([values, state]) => {
        const [value, next] = randomInt(min, max, state)
        return [[...values, value], next]
      },
      [[], start]
    )[0]

  // sfc32 is not reversible, so it skips the steps backwards
  const describe = (state, reversible) => ({
    state,
    outputs: draws(0, 100, state, 5),
    rejecting: draws(0, 2 ** 31 + 1, state, 3),
    next: getOutput(nextState(state)),
    jumped: stepState(1000, state).state,
    list: randomList(4, randomInt(0, 10), state).map(([value]) => value),
    ...(reversible ? { rewound: prevState(nextState(state)).state, jumpedBack: stepState(-1000, state).state } : {}),
  })

  const seeds = [42, -1, 2 ** 53 - 1, BigInt(12345), '54']

  const pcg32 = Object.values(OutputFnType).flatMap((outputFnType) =>
    Object.values(StreamScheme).flatMap((streamScheme) =>
      seeds.map((seed) => ({
        outputFnType,
        streamScheme,
        seed: String(seed),
        ...describe(createPcg32({ outputFnType, streamScheme }, seed, 54), true),
      }))
    )
  )

  const sample = createPcg32({}, 42, 54)
  return {
    OutputFnType,
    StreamScheme,
    pcg32,
    alias: JSON.stringify(createPcg({}, 42, 54)) === JSON.stringify(sample),
    bigint: [String(toBigInt(sample.state)), fromBigInt(toBigInt(sample.state))],
    mulberry32: seeds.map((seed) => describe(createMulberry32(seed), true)),
    sfc32: seeds.map((seed) => describe(createSfc32(seed), false)),
  }
}

module.exports = { fingerprint }
