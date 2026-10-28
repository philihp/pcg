// The hot paths compute the same values as the general code they replace:
// the one-step LCG, its inverse, BigInt-free seeding, and randomInt's early
// accept and fast modulo. Each is checked against a plain reference.

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createMulberry32, createPcg32, createSfc32, getOutput, nextState, prevState, randomInt, stepState } from '..'
import { pcgDefaultMultiplierInverse64 } from '../defaults'
import { OutputFnType, StreamScheme } from '../types'
import type { PCGState, Uint64 } from '../types'

const MASK_32 = 0xffffffffn
const MASK_64 = 0xffffffffffffffffn
const MULT = 6364136223846793005n
const INC = 1442695040888963407n

const toBig = ({ hi, lo }: Uint64): bigint => (BigInt(hi) << 32n) | BigInt(lo)
const fromBig = (v: bigint): Uint64 => ({
  hi: Number((v >> 32n) & MASK_32),
  lo: Number(v & MASK_32),
})

const referenceNext = (state: bigint, increment: bigint): bigint => (state * MULT + increment) & MASK_64

const referenceStreamId = (stream: bigint): bigint => (((stream & MASK_64) << 1n) | 1n) & MASK_64

// createPcg32 as the BigInt formula: seed the state, then take one step.
const referenceCreate = (seed: bigint, stream: bigint): Uint64 => {
  const streamId = referenceStreamId(stream)
  return fromBig(referenceNext((streamId + seed) & MASK_64, streamId))
}

// The textbook randomInt loop: the threshold computed on every call, the
// remainder via %.
const referenceDraw = (min: number, max: number, pcg: PCGState): [number, PCGState] => {
  const bound = max - min
  const threshold = (2 ** 32 - bound) % bound
  let n: number
  let s = pcg
  do {
    n = getOutput(s)
    s = nextState(s)
  } while (n < threshold)
  return [(n % bound) + min, s]
}

describe('prevState inverse-multiplier fast path', () => {
  test('the inverse constant really inverts the multiplier mod 2^64', () => {
    assert.equal((MULT * pcgDefaultMultiplierInverse64) & MASK_64, 1n)
  })

  for (const [name, streamScheme, increment] of [
    ['SETSEQ', StreamScheme.SETSEQ, referenceStreamId(54n)],
    ['ONESEQ', StreamScheme.ONESEQ, INC],
    ['MCG', StreamScheme.MCG, 0n],
  ] as const) {
    test(`prevState matches the BigInt inverse LCG for ${name} across 1k iterations`, () => {
      let live = createPcg32({ streamScheme }, 42, 54)
      let refState = toBig(live.state)
      for (let i = 0; i < 1000; i++) {
        live = prevState(live)
        refState = ((refState - increment) * pcgDefaultMultiplierInverse64) & MASK_64
        assert.deepEqual(live.state, fromBig(refState))
      }
    })
  }

  test('prevState lands where the 64-round jump-ahead lands', () => {
    const pcg = createPcg32({}, 7, 11)
    // -1 takes the fast path; -2 and -3 go through the general loop.
    assert.deepEqual(prevState(pcg), nextState(stepState(-2, pcg)))
    assert.deepEqual(prevState(prevState(prevState(pcg))), stepState(-3, pcg))
  })
})

describe('createPcg32 seeds number inputs without BigInt', () => {
  const seeds = [
    0,
    -0,
    1,
    -1,
    42,
    2 ** 31,
    2 ** 32 - 1,
    2 ** 32,
    2 ** 53 - 1,
    -(2 ** 53 - 1),
    2 ** 53,
    2 ** 64,
    2 ** 64 + 2 ** 12,
    -(2 ** 64),
    1e20,
    -1e20,
    Number.MAX_VALUE,
    -Number.MAX_VALUE,
  ]

  test('number seeds and stream ids match the BigInt seeding formula', () => {
    for (const seed of seeds) {
      for (const stream of seeds) {
        const pcg = createPcg32({}, seed, stream)
        assert.deepEqual(pcg.state, referenceCreate(BigInt(seed), BigInt(stream)), `seed=${seed} stream=${stream}`)
        assert.deepEqual(pcg.streamId, fromBig(referenceStreamId(BigInt(stream))))
      }
    }
  })

  test('bigint and string seeds take the BigInt path and agree with number seeds', () => {
    assert.deepEqual(createPcg32({}, 42n, '54'), createPcg32({}, 42, 54))
    assert.deepEqual(createPcg32({}, '-1', 2n ** 64n + 54n), createPcg32({}, -1, 54))
  })

  test('rejects what BigInt rejects', () => {
    assert.throws(() => createPcg32({}, 1.5, 54), RangeError)
    assert.throws(() => createPcg32({}, 42, Number.NaN), RangeError)
    assert.throws(() => createPcg32({}, '1e3', 54), SyntaxError)
  })
})

describe('randomInt early accept and fast modulo', () => {
  const bounds = [1, 2, 3, 10, 100, 65536, 2 ** 31 - 1, 2 ** 31 + 1, 2 ** 31 + 12345, 2 ** 32 - 1, 2 ** 32]

  for (const [name, make] of [
    ['pcg32', () => createPcg32({}, 42, 12345)],
    [
      'pcg32 RXS_M_XS ONESEQ',
      () => createPcg32({ outputFnType: OutputFnType.RXS_M_XS, streamScheme: StreamScheme.ONESEQ }, 42, 12345),
    ],
    ['mulberry32', () => createMulberry32(42)],
    ['sfc32', () => createSfc32(42)],
  ] as const) {
    test(`${name} agrees with the reference draw for every bound, min offset and rejection`, () => {
      for (const bound of bounds) {
        for (const min of [0, -7, 1000]) {
          let s = make()
          for (let i = 0; i < 500; i++) {
            const expected = referenceDraw(min, min + bound, s)
            const actual = randomInt(min, min + bound, s)
            assert.deepEqual(actual, expected)
            s = actual[1]
          }
        }
      }
    })
  }

  test('a non-integer bound keeps the exact float remainder', () => {
    for (const bound of [2.5, 0.1, 10.75, 123.456]) {
      let s = createPcg32({}, 42, 54)
      for (let i = 0; i < 100; i++) {
        const expected = referenceDraw(0, bound, s)
        const actual = randomInt(0, bound, s)
        assert.deepEqual(actual, expected)
        s = actual[1]
      }
    }
  })

  test('a bound just above 2^31 rejects about half of the draws', () => {
    // bound 2^31 + 1 has threshold 2^31 - 1, so about half of the raw draws
    // are rejected and a call often consumes several states.
    let s = createPcg32({}, 1, 2)
    let consumed = 0
    for (let i = 0; i < 2000; i++) {
      const [, next] = randomInt(0, 2 ** 31 + 1, s)
      let probe = nextState(s)
      consumed++
      while (probe.state.lo !== next.state.lo || probe.state.hi !== next.state.hi) {
        probe = nextState(probe)
        consumed++
      }
      s = next
    }
    assert.ok(consumed > 3000 && consumed < 5000, `consumed ${consumed} states for 2000 draws`)
  })
})

describe('64-bit carry out of the low word', () => {
  // On stream 12345 the increment's low word is 24691, so a step carries only
  // when the product's low word lands within 24691 of 2^32: about one step in
  // 170,000. These seeds reach such a step within their first few draws.
  const streamInc = referenceStreamId(12345n)
  for (const seed of [49184, 73598]) {
    test(`seed ${seed} carries early and matches the BigInt LCG`, () => {
      let live = createPcg32({}, seed, 12345)
      let refState = toBig(live.state)
      // The low word wrapped when the sum landed below the increment it added.
      let carries = live.state.lo < Number(streamInc) ? 1 : 0
      for (let i = 0; i < 8; i++) {
        live = nextState(live)
        refState = referenceNext(refState, streamInc)
        assert.deepEqual(live.state, fromBig(refState))
        if (live.state.lo < Number(streamInc)) carries++
      }
      assert.ok(carries >= 1)
    })
  }
})

describe('sfc32 register walk', () => {
  test('stepState(n) agrees with n single steps, including 0 and 1', () => {
    const s0 = createSfc32(2026)
    for (const delta of [0, 1, 2, 15, 100]) {
      let walked = s0
      for (let i = 0; i < delta; i++) walked = nextState(walked)
      assert.deepEqual(stepState(delta, s0), walked)
    }
  })
})
