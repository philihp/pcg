# pcg

[![Version](https://img.shields.io/npm/v/pcg.svg)](https://www.npmjs.com/package/pcg)
[![Tests](https://github.com/philihp/pcg/actions/workflows/tests.yml/badge.svg)](https://github.com/philihp/pcg/actions/workflows/tests.yml)
[![Coverage](https://coveralls.io/repos/github/philihp/pcg/badge.svg?branch=main)](https://coveralls.io/github/philihp/pcg?branch=main)
![Downloads](https://img.shields.io/npm/dt/pcg)
![License](https://img.shields.io/npm/l/pcg)

A functional implementation of the [PCG family random number generators](), written in JavaScript.

[PCG family random number generators]: http://pcg-random.org

## Getting started

First, seed a PCG state. A stream ID specifies _which_ unique periodic entropy series to use. The state specifies _where_ in that series we start. Togethery they both function as a seed.

```js
import { createPcg32, randomInt, randomList } from 'pcg'

const advancedOptions = {}
const initState = 42
const initStreamId = 54
const state0 = createPcg32(advancedOptions, initState, initStreamId)
```

After that, random outputs can be generated:

```js
const randomUint32 = randomInt(0, 2 ** 32 - 1)
const [value1, state1] = randomUint32(state0)
const [value2, state2] = randomUint32(state1)
const [value3, state3] = randomUint32(state2)
```

You can also grab multiple at once with randomList:
```js
const listLength = 3
const listGenerator = randomInt(0, 2 ** 32 - 1)
const [
  [value1, state1],
  [value2, state2],
  [value3, state3],
] = randomList(listLength, listGenerator, state0)
```

The result of both of these will return the same state.

## Stream schemes

`createPcg32` accepts a `streamScheme` option that selects how the LCG increment is derived from the seed. The default is `SETSEQ`.

- `SETSEQ` (default) — distinct stream per `streamId` (the standard "set-seq" PCG variant).
- `ONESEQ` — a single fixed stream; `streamId` is ignored.
- `MCG` — multiplicative congruential generator (increment = 0); shorter period, slightly cheaper per step.

```js
import { createPcg32 } from 'pcg'

const state0 = createPcg32({ streamScheme: 'ONESEQ' }, 42, 54)
```

## Mulberry32

`mulberry32` is a small 32-bit counter-based PRNG (by Tommy Ettinger). It is
not part of the PCG family and has a much shorter period (2^32) and weaker
statistical properties, but the seed is a single number and each step is
cheap. The resulting state plugs into the same `nextState`, `getOutput`,
`randomInt`, `randomList`, and `stepState` functions.

```js
import { createMulberry32, randomInt } from 'pcg'

const state0 = createMulberry32(42)
const [value, state1] = randomInt(0, 100, state0)
```

## Thanks

- [@kripod](https://github.com/kripod/), who wrote the original [`pcg.js`](https://github.com/kripod/pcg.js)
