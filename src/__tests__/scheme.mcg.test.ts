import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createPcg32, randomInt, randomList } from '..'
import { StreamScheme } from '../types'

describe('mcg', () => {
  test('generates a list', () => {
    const pcg = createPcg32({ streamScheme: StreamScheme.MCG }, 42, 54)

    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const out = randomList(6, randomUint32, pcg)

    assert.equal(out.length, 6)
    assert.deepEqual(
      out.map((n) => n[0]),
      [2707161783, 481379097, 3013076618, 44264614, 123970576, 1499079222]
    )

    // the next int after the 3rd state is the 4th int
    assert.equal(randomUint32(out[2][1])[0], out[3][0])
  })
})
