// Smoke tests for the @deprecated 2.0.0-era exports that we keep around as
// aliases until 3.0.0. If any of these stop working, downstream consumers who
// upgraded to 2.0.0 will see a hard break.

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fromBigInt, toBigInt } from '..'
import type { LongLike, StreamSchemeName } from '..'
import { StreamScheme } from '..'

describe('deprecated 2.0.0 exports', () => {
  test('toBigInt round-trips with fromBigInt', () => {
    const values = [0n, 1n, 0xffffffffn, 0x100000000n, 0xdeadbeefcafebaben]
    for (const v of values) {
      assert.equal(toBigInt(fromBigInt(v)), v)
    }
  })

  test('fromBigInt produces JSON-clean { hi, lo } objects', () => {
    const u = fromBigInt(0x123456789abcdef0n)
    assert.deepEqual(u, { hi: 0x12345678, lo: 0x9abcdef0 })
    assert.deepEqual(JSON.parse(JSON.stringify(u)), u)
  })

  test('LongLike still accepts bigint, number, and string', () => {
    const a: LongLike = 42
    const b: LongLike = 42n
    const c: LongLike = '42'
    assert.equal(typeof a, 'number')
    assert.equal(typeof b, 'bigint')
    assert.equal(typeof c, 'string')
  })

  test('StreamSchemeName matches the StreamScheme keys', () => {
    const setseq: StreamSchemeName = 'SETSEQ'
    const oneseq: StreamSchemeName = 'ONESEQ'
    const mcg: StreamSchemeName = 'MCG'
    assert.equal(StreamScheme[setseq], StreamScheme.SETSEQ)
    assert.equal(StreamScheme[oneseq], StreamScheme.ONESEQ)
    assert.equal(StreamScheme[mcg], StreamScheme.MCG)
  })
})
