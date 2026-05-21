import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createPcg32 } from '..'
import { StreamScheme } from '../types'

describe('streamScheme accepts a string name', () => {
  for (const name of ['SETSEQ', 'ONESEQ', 'MCG'] as const) {
    test(`matches the enum for ${name}`, () => {
      const fromString = createPcg32({ streamScheme: name }, 42, 54)
      const fromEnum = createPcg32({ streamScheme: StreamScheme[name] }, 42, 54)
      assert.deepEqual(fromString, fromEnum)
      assert.equal(fromString.streamScheme, StreamScheme[name])
    })
  }

  test('throws on an unknown scheme name', () => {
    assert.throws(
      () =>
        // @ts-expect-error - intentionally invalid name
        createPcg32({ streamScheme: 'NOPE' }, 42, 54),
      /Unknown stream scheme/
    )
  })
})
