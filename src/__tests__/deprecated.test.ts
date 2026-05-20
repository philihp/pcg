// Smoke tests for the @deprecated 2.0.0-era exports that we keep around as
// aliases until 3.0.0. If any of these stop working, downstream consumers who
// upgraded to 2.0.0 will see a hard break.

import { fromBigInt, toBigInt } from '..'
import type { LongLike, StreamSchemeName } from '..'
import { StreamScheme } from '..'

describe('deprecated 2.0.0 exports', () => {
  it('toBigInt round-trips with fromBigInt', () => {
    expect.assertions(5)
    const values = [0n, 1n, 0xffffffffn, 0x100000000n, 0xdeadbeefcafebaben]
    for (const v of values) {
      expect(toBigInt(fromBigInt(v))).toBe(v)
    }
  })

  it('fromBigInt produces JSON-clean { hi, lo } objects', () => {
    expect.assertions(2)
    const u = fromBigInt(0x123456789abcdef0n)
    expect(u).toEqual({ hi: 0x12345678, lo: 0x9abcdef0 })
    expect(JSON.parse(JSON.stringify(u))).toEqual(u)
  })

  it('LongLike still accepts bigint, number, and string', () => {
    expect.assertions(3)
    const a: LongLike = 42
    const b: LongLike = 42n
    const c: LongLike = '42'
    expect(typeof a).toBe('number')
    expect(typeof b).toBe('bigint')
    expect(typeof c).toBe('string')
  })

  it('StreamSchemeName matches the StreamScheme keys', () => {
    expect.assertions(3)
    const setseq: StreamSchemeName = 'SETSEQ'
    const oneseq: StreamSchemeName = 'ONESEQ'
    const mcg: StreamSchemeName = 'MCG'
    expect(StreamScheme[setseq]).toBe(StreamScheme.SETSEQ)
    expect(StreamScheme[oneseq]).toBe(StreamScheme.ONESEQ)
    expect(StreamScheme[mcg]).toBe(StreamScheme.MCG)
  })
})
