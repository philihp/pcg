import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { ror32 } from '../bitwise'

describe('bitwise', () => {
  describe('ror32', () => {
    test('works', () => {
      assert.ok(true)
    })
    test('shifts 54 by 42', () => {
      assert.equal(ror32(54, 42), 43008)
    })
    test('shifts -54 by 42', () => {
      assert.equal(ror32(-54, 42), 176160768)
    })
    test('shifts 54 by -42', () => {
      assert.equal(ror32(54, -42), 4294925311)
    })
    test('shifts -54 by -42', () => {
      assert.equal(ror32(-54, -42), 4123000831)
    })
  })
})
