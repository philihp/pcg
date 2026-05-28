# pcg

A functional implementation of the [PCG family random number generators](http://pcg-random.org), written in TypeScript. Runs are reproducible, replayable, and rewindable. State can be serialized and reconstituted later. Ships dual ESM/CJS builds and TypeScript types. Runs on Node 18+, Bun, Deno, and modern browsers.

[![Version](https://img.shields.io/npm/v/pcg.svg)](https://www.npmjs.com/package/pcg)
[![Tests](https://github.com/philihp/pcg/actions/workflows/tests.yml/badge.svg)](https://github.com/philihp/pcg/actions/workflows/tests.yml)
[![Coverage](https://coveralls.io/repos/github/philihp/pcg/badge.svg?branch=main)](https://coveralls.io/github/philihp/pcg?branch=main)
[![Bundle size](https://img.shields.io/bundlephobia/minzip/pcg)](https://bundlephobia.com/package/pcg)
![Downloads](https://img.shields.io/npm/dm/pcg)
![License](https://img.shields.io/npm/l/pcg)

## Quick start

```ts
import { createPcg32, nextState, randomInt, randomList } from 'pcg'

// A stream id picks *which* unique periodic series of entropy to use.
// The seed picks *where* in that series to start.
const state0 = createPcg32({}, 42, 54)

const randomUint32 = randomInt(0, 2 ** 32)
const [value, state1] = randomUint32(state0)

const list = randomList(3, randomUint32, state0)
// list === [[v0, s0], [v1, s1], [v2, s2]] — value === v0, state1 === s0
```

`state0` is never mutated. Pass `state1` into the next call to continue the stream, or hold onto `state0` and replay it. Persist a state with `JSON.stringify(state0)` and rehydrate with `JSON.parse`.

## API

### Initialize state

`createPcg32(options, seed, streamId) → PCGState`

```ts
import { createPcg32, OutputFnType, StreamScheme } from 'pcg'

const state = createPcg32(
  {
    outputFnType: OutputFnType.XSH_RR,
    streamScheme: StreamScheme.SETSEQ,
  },
  42,
  54
)
```

**Output functions** (`OutputFnType`) — different ways of permuting the 64-bit state into a 32-bit word.

| Variant              | Notes                                                                          |
| -------------------- | ------------------------------------------------------------------------------ |
| `XSH_RR` _(default)_ | xor-shift high, random rotate. The PCG default; good all-rounder.              |
| `XSH_RS`             | xor-shift high, random shift. Slightly faster, marginally weaker.              |
| `XSL_RR`             | xor-shift low, random rotate.                                                  |
| `RXS_M_XS`           | random xor-shift, multiply, xor-shift. Strongest of the four; slightly slower. |

**Stream schemes** (`StreamScheme`) — how the increment is chosen each step.

| Variant              | Notes                                                                             |
| -------------------- | --------------------------------------------------------------------------------- |
| `SETSEQ` _(default)_ | Per-state stream id; lets independent streams coexist from one seed family.       |
| `ONESEQ`             | Single fixed increment; ignores `streamId`.                                       |
| `MCG`                | Multiplicative congruential generator (no increment). Fastest, but period halved. |

### Drawing values

- `randomInt(min, max, state) → [number, PCGState]` — uniform integer in `[min, max)`. Curried so `const random = randomInt(min, max); random(state)` also works.
- `randomList(length, rng, state) → [value, PCGState][]` — runs `rng` `length` times, threading the state. Also fully curried.
- `getOutput(state) → number` — output at the current state without advance.

### Advancing state

- `nextState(state) → PCGState` — advance by 1.
- `prevState(state) → PCGState` — rewind by 1. Unsupported by sfc32.
- `stepState(delta, state) → PCGState` — jump ahead or back where delta is a signed integer. O(log Δ) via Brown's jump-ahead algorithm for PCG.

### Types

`PCGState`, `Uint64`, `RandomFn<T>`, `CreatePcgOptions`, `OutputFn`, `SchemeFn`, `PCGVariant` are all exported. State is `{ state: Uint64, streamId: Uint64, variant, outputFnType, streamScheme }` where `Uint64` is `{ hi: number, lo: number }`.

## Migrating from 1.x

`PCGState` is no longer a `bigint`. The 64-bit halves are now `{ hi: number, lo:number }` objects, so serialization with `JSON.stringify` round-trips cleanly.

See [`CHANGELOG.md`](./CHANGELOG.md) for the full set of changes.

## Thanks

- [@kripod](https://github.com/kripod/), who wrote the original [`pcg.js`](https://github.com/kripod/pcg.js).
- [Melissa O'Neill](https://www.cs.hmc.edu/~oneill/), for her work on the [PCG family](http://pcg-random.org).
