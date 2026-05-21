import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createPcg32, nextState, stepState, randomInt } from '..'

describe('stepState', () => {
  test('can step forward multiple states', () => {
    const random = randomInt(0, 2 ** 32 - 1)
    const s0 = createPcg32({}, 42, 54)

    const s1 = nextState(s0)
    const s2 = nextState(s1)
    const s3 = nextState(s2)
    const s4 = nextState(s3)
    const q4 = stepState(4, s0)
    assert.equal(random(s4)[0], random(q4)[0])
  })
})
