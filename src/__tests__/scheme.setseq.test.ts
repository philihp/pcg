import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createPcg32, randomInt, randomList } from '..'
import { StreamScheme } from '../types'

describe('setseq', () => {
  test('generates a list', () => {
    const pcg = createPcg32({ streamScheme: StreamScheme.SETSEQ }, 42, 54)

    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const out = randomList(6, randomUint32, pcg)

    assert.equal(out.length, 6)
    assert.deepEqual(
      out.map((n) => n[0]),
      [2707161783, 2068313097, 3122475824, 2211639955, 3215226955, 3421331566]
    )

    // the next int after the 3rd state is the 4th int
    assert.equal(randomUint32(out[2][1])[0], out[3][0])
  })
})
