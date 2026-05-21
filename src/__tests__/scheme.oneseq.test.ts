import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createPcg32, randomInt, randomList } from '..'
import { StreamScheme } from '../types'

describe('oneseq', () => {
  test('generates a list', () => {
    const pcg = createPcg32({ streamScheme: StreamScheme.ONESEQ }, 42, 54)

    const randomUint32 = randomInt(0, 2 ** 32 - 1)
    const out = randomList(6, randomUint32, pcg)

    assert.equal(out.length, 6)
    assert.deepEqual(
      out.map((n) => n[0]),
      [73173280, 3745155691, 2856497084, 4276626055, 3324726470, 3500761220]
    )

    // the next int after the 3rd state is the 4th int
    assert.equal(randomUint32(out[2][1])[0], out[3][0])
  })
})
