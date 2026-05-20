# pcg

[![Version](https://img.shields.io/npm/v/pcg.svg)](https://www.npmjs.com/package/pcg)
[![Tests](https://github.com/philihp/pcg/actions/workflows/tests.yml/badge.svg)](https://github.com/philihp/pcg/actions/workflows/tests.yml)
[![Coverage](https://coveralls.io/repos/github/philihp/pcg/badge.svg?branch=main)](https://coveralls.io/github/philihp/pcg?branch=main)
![Downloads](https://img.shields.io/npm/dt/pcg)
![License](https://img.shields.io/npm/l/pcg)

A functional implementation of the [PCG family random number generators](), written in JavaScript.

[PCG family random number generators]: http://pcg-random.org

## Getting started

First, seed a PCG state. A stream ID specifies _which_ unique periodic entropy series to use. The state specifies _where_ in that series we start. Together they both function as a seed.

```js
import { createPcg32, randomInt, randomList, randomUint32 } from 'pcg'

const initState = 42
const initStreamId = 54
const state0 = createPcg32(initState, initStreamId)
```

After that, random outputs can be generated:

```js
const [value1, state1] = randomUint32(state0)
const [value2, state2] = randomUint32(state1)
const [value3, state3] = randomUint32(state2)
```

For a bounded range, use `randomInt(min, max, state)`:

```js
const [diceRoll, nextState] = randomInt(1, 7, state0) // 1..6
```

You can also grab multiple at once with `randomList`:

```js
const [
  [value1, state1],
  [value2, state2],
  [value3, state3],
] = randomList(3, randomUint32, state0)
```

## Implementations

The default API (`createPcg32`, `nextState`, `randomInt`, `randomList`, `randomUint32`, `getOutput`, `stepState`, `prevState`) is the fast BigInt-free implementation. It commits to the standard PCG configuration: the `SETSEQ` stream scheme with the `XSH_RR` output function. State is carried as four `uint32` numbers (`{sHi, sLo, iHi, iLo}`) and 64-bit arithmetic is done with a 16-bit-limb-split multiply, so partial products stay inside 2^53.

If you need a different stream scheme or output function, the original BigInt-backed implementation is exported with a `64` suffix:

```js
import { createPcg64, randomInt64, OutputFnType, StreamScheme } from 'pcg'

const state0 = createPcg64({ streamScheme: 'ONESEQ', outputFnType: OutputFnType.RXS_M_XS }, 42, 54)
const [n, state1] = randomInt64(0, 100, state0)
```

The `createPcg64` API also retains the curried form (`randomInt64(min, max)(state)`).

### Stream schemes (createPcg64 only)

- `SETSEQ` (default) — distinct stream per `streamId` (the standard "set-seq" PCG variant).
- `ONESEQ` — a single fixed stream; `streamId` is ignored.
- `MCG` — multiplicative congruential generator (increment = 0); shorter period, slightly cheaper per step.

## Thanks

- [@kripod](https://github.com/kripod/), who wrote the original [`pcg.js`](https://github.com/kripod/pcg.js)
