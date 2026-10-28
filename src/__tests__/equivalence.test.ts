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

// The textbook randomInt draw: the threshold computed on every call, a
// rejected draw replaced by the next one, the remainder via %.
const referenceDraw = (min: number, max: number, pcg: PCGState): [number, PCGState] => {
  const bound = max - min
  const threshold = (2 ** 32 - bound) % bound
  const draw = (s: PCGState): [number, PCGState] => {
    const n = getOutput(s)
    return n < threshold ? draw(nextState(s)) : [(n % bound) + min, nextState(s)]
  }
  return draw(pcg)
}

const sameState = (a: PCGState, b: PCGState): boolean => a.state.lo === b.state.lo && a.state.hi === b.state.hi

// `draws` calls of randomInt(min, max) chained from `start`, each checked
// against the reference draw.
const checkDraws = (min: number, max: number, start: PCGState, draws: number): PCGState =>
  Array.from({ length: draws }).reduce<PCGState>((s) => {
    const actual = randomInt(min, max, s)
    assert.deepEqual(actual, referenceDraw(min, max, s))
    return actual[1]
  }, start)

// How many single steps lead from one state to a later one.
const stepsBetween = (from: PCGState, to: PCGState): number =>
  sameState(from, to) ? 0 : 1 + stepsBetween(nextState(from), to)

describe('prevState inverse-multiplier fast path', () => {
  test('the inverse constant really inverts the multiplier mod 2^64', () => {
    assert.equal((MULT * pcgDefaultMultiplierInverse64) & MASK_64, 1n)
  })

  const schemes = [
    ['SETSEQ', StreamScheme.SETSEQ, referenceStreamId(54n)],
    ['ONESEQ', StreamScheme.ONESEQ, INC],
    ['MCG', StreamScheme.MCG, 0n],
  ] as const
  schemes.forEach(([name, streamScheme, increment]) => {
    test(`prevState matches the BigInt inverse LCG for ${name} across 1k iterations`, () => {
      const start = createPcg32({ streamScheme }, 42, 54)
      Array.from({ length: 1000 }).reduce<[PCGState, bigint]>(
        ([live, refState]) => {
          const prevLive = prevState(live)
          const prevRef = ((refState - increment) * pcgDefaultMultiplierInverse64) & MASK_64
          assert.deepEqual(prevLive.state, fromBig(prevRef))
          return [prevLive, prevRef]
        },
        [start, toBig(start.state)]
      )
    })
  })

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
    seeds.forEach((seed) =>
      seeds.forEach((stream) => {
        const pcg = createPcg32({}, seed, stream)
        assert.deepEqual(pcg.state, referenceCreate(BigInt(seed), BigInt(stream)), `seed=${seed} stream=${stream}`)
        assert.deepEqual(pcg.streamId, fromBig(referenceStreamId(BigInt(stream))))
      })
    )
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

  const generators = [
    ['pcg32', () => createPcg32({}, 42, 12345)],
    [
      'pcg32 RXS_M_XS ONESEQ',
      () => createPcg32({ outputFnType: OutputFnType.RXS_M_XS, streamScheme: StreamScheme.ONESEQ }, 42, 12345),
    ],
    ['mulberry32', () => createMulberry32(42)],
    ['sfc32', () => createSfc32(42)],
  ] as const
  generators.forEach(([name, make]) => {
    test(`${name} agrees with the reference draw for every bound, min offset and rejection`, () => {
      bounds.forEach((bound) => [0, -7, 1000].forEach((min) => checkDraws(min, min + bound, make(), 500)))
    })
  })

  test('a non-integer bound keeps the exact float remainder', () => {
    const fractionalBounds = [2.5, 0.1, 10.75, 123.456]
    fractionalBounds.forEach((bound) => checkDraws(0, bound, createPcg32({}, 42, 54), 100))
  })

  test('a bound just above 2^31 rejects about half of the draws', () => {
    // bound 2^31 + 1 has threshold 2^31 - 1, so about half of the raw draws
    // are rejected and a call often consumes several states.
    const { consumed } = Array.from({ length: 2000 }).reduce<{ s: PCGState; consumed: number }>(
      ({ s, consumed: soFar }) => {
        const [, next] = randomInt(0, 2 ** 31 + 1, s)
        return { s: next, consumed: soFar + stepsBetween(s, next) }
      },
      { s: createPcg32({}, 1, 2), consumed: 0 }
    )
    assert.ok(consumed > 3000 && consumed < 5000, `consumed ${consumed} states for 2000 draws`)
  })
})

describe('64-bit carry out of the low word', () => {
  // On stream 12345 the increment's low word is 24691, so a step carries only
  // when the product's low word lands within 24691 of 2^32: about one step in
  // 170,000. These seeds reach such a step within their first few draws.
  const streamInc = referenceStreamId(12345n)
  // The low word wrapped when the sum landed below the increment it added.
  const carried = (pcg: PCGState): number => (pcg.state.lo < Number(streamInc) ? 1 : 0)
  const earlyCarrySeeds = [49184, 73598]
  earlyCarrySeeds.forEach((seed) => {
    test(`seed ${seed} carries early and matches the BigInt LCG`, () => {
      const start = createPcg32({}, seed, 12345)
      const [, , carries] = Array.from({ length: 8 }).reduce<[PCGState, bigint, number]>(
        ([live, refState, count]) => {
          const nextLive = nextState(live)
          const nextRef = referenceNext(refState, streamInc)
          assert.deepEqual(nextLive.state, fromBig(nextRef))
          return [nextLive, nextRef, count + carried(nextLive)]
        },
        [start, toBig(start.state), carried(start)]
      )
      assert.ok(carries >= 1)
    })
  })
})

describe('sfc32 register walk', () => {
  test('stepState(n) agrees with n single steps, including 0 and 1', () => {
    const s0 = createSfc32(2026)
    const deltas = [0, 1, 2, 15, 100]
    deltas.forEach((delta) => {
      const walked = Array.from({ length: delta }).reduce<PCGState>((s) => nextState(s), s0)
      assert.deepEqual(stepState(delta, s0), walked)
    })
  })
})
