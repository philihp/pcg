# pcg

[![Version](https://img.shields.io/npm/v/pcg.svg)](https://www.npmjs.com/package/pcg)
[![Tests](https://github.com/philihp/pcg/actions/workflows/tests.yml/badge.svg)](https://github.com/philihp/pcg/actions/workflows/tests.yml)
[![Coverage](https://coveralls.io/repos/github/philihp/pcg/badge.svg?branch=main)](https://coveralls.io/github/philihp/pcg?branch=main)
![Downloads](https://img.shields.io/npm/dt/pcg)
![License](https://img.shields.io/npm/l/pcg)

A functional TypeScript implementation of the [PCG family of random number generators](http://pcg-random.org), plus a couple of lightweight alternatives (`mulberry32`, `sfc32`) that share the same API.

State is immutable: every call returns a `[value, nextState]` tuple, so the same input always produces the same output. This makes runs reproducible, replayable, and trivially serializable — `PCGState` is plain JSON (`{ hi, lo }` halves, no `bigint`s).

## Install

```sh
npm install pcg
```

The package ships dual ESM/CJS builds and TypeScript types. Node 18+ is supported; Node 22+ is recommended.

## Quick start

```ts
import { createPcg32, nextState, randomInt, randomList } from 'pcg'

// A stream id picks *which* unique periodic series of entropy to use.
// The seed picks *where* in that series to start.
const state0 = createPcg32({}, 42, 54)

const randomUint32 = randomInt(0, 2 ** 32 - 1)
const [value, state1] = randomUint32(state0)

const list = randomList(3, randomUint32, state0)
// list === [[v0, s0], [v1, s1], [v2, s2]] — value === v0, state1 === s0
```

`state0` is never mutated. Pass `state1` into the next call to continue the stream, or hold onto `state0` and replay it. Persist a state with `JSON.stringify(state0)` and rehydrate with `JSON.parse`.

## API

### Factories

| Function | State size | Notes |
| --- | --- | --- |
| `createPcg32(options, seed, streamId)` | 64-bit | Full PCG; reversible; supports stream schemes and output functions. |
| `createMulberry32(seed)` | 32-bit | Tommy Ettinger's mulberry32. Compact and fast. Period 2³². |
| `createSfc32(seed)` | 128-bit | Chris Doty-Humphrey's sfc32. Passes PractRand. **Not reversible** — `prevState` / negative `stepState` deltas throw. |

All three return a `PCGState` and work with every function below.

### Drawing values

- `randomInt(min, max)(state) → [number, PCGState]` — uniform integer in `[min, max)`. Curried in any arity (`randomInt(min)(max)(state)`, `randomInt(min, max, state)`, etc.).
- `randomList(length, rng, state) → [value, PCGState][]` — runs `rng` `length` times, threading the state. Also fully curried.
- `getOutput(state) → number` — raw 32-bit output for the current state, no advance.

### Advancing the state

- `nextState(state) → PCGState` — advance by 1 (fast path).
- `prevState(state) → PCGState` — rewind by 1 (PCG only).
- `stepState(delta, state) → PCGState` — jump ahead or back by any signed integer. Curried: `stepState(delta)(state)`. O(log Δ) via Brown's jump-ahead algorithm for PCG; O(Δ) and forward-only for sfc32.

### Configuring `createPcg32`

```ts
import { createPcg32, OutputFnType, StreamScheme } from 'pcg'

const state = createPcg32(
  { outputFnType: OutputFnType.XSH_RR, streamScheme: StreamScheme.SETSEQ },
  42n,
  54n
)
```

**Output functions** (`OutputFnType`) — different ways of permuting the 64-bit state into a 32-bit word.

| Variant | Notes |
| --- | --- |
| `XSH_RR` *(default)* | xor-shift high, random rotate. The PCG default; good all-rounder. |
| `XSH_RS` | xor-shift high, random shift. Slightly faster, marginally weaker. |
| `XSL_RR` | xor-shift low, random rotate. |
| `RXS_M_XS` | random xor-shift, multiply, xor-shift. Strongest of the four; slightly slower. |

**Stream schemes** (`StreamScheme`) — how the increment is chosen each step.

| Variant | Notes |
| --- | --- |
| `SETSEQ` *(default)* | Per-state stream id; lets independent streams coexist from one seed family. |
| `ONESEQ` | Single fixed increment; ignores `streamId`. |
| `MCG` | Multiplicative congruential generator (no increment). Fastest, period halved. |

Both options also accept their string names (`'XSH_RR'`, `'SETSEQ'`, …) if you'd rather not import the enums.

### Types

`PCGState`, `Uint64`, `RandomFn<T>`, `CreatePcgOptions`, `OutputFn`, `SchemeFn`, `PCGVariant` are all exported. State is `{ state: Uint64, streamId: Uint64, variant, outputFnType, streamScheme }` where `Uint64` is `{ hi: number, lo: number }`.

## Picking a generator

- **PCG32** — the default. Use it unless you have a reason not to. Stream selection, reversible, ~7× faster hot path since 2.0.
- **mulberry32** — pick when you want the smallest possible state (one `uint32`) and don't need a long period or multiple streams. Good for procedurally generated UI, one-off shuffles.
- **sfc32** — pick when you want a chaotic generator with strong statistical properties and don't need to rewind. State is 128 bits but every op is 32-bit, so it's quick in JS.

## Migrating from 1.x

`PCGState` is no longer a `bigint`. The 64-bit halves are now `{ hi, lo }` objects, which means `JSON.stringify` round-trips cleanly — but raw v1.x state will not deserialize into v2.x. Re-seed and replay, or convert with the (deprecated) `fromBigInt` / `toBigInt` helpers.

See [`CHANGELOG.md`](./CHANGELOG.md) for the full set of changes.

## Thanks

- [@kripod](https://github.com/kripod/), who wrote the original [`pcg.js`](https://github.com/kripod/pcg.js).
- Melissa O'Neill, for the [PCG family](http://pcg-random.org).
