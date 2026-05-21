import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createPcg, createPcg32, nextState, randomInt } from '..'

describe('PCGVariant tag', () => {
  test('stamps new state objects with variant: "pcg32"', () => {
    const pcg = createPcg({}, 42, 54)
    assert.equal(pcg.variant, 'pcg32')
  })

  test('preserves the variant tag across nextState', () => {
    let pcg = createPcg({}, 42, 54)
    for (let i = 0; i < 10; i++) pcg = nextState(pcg)
    assert.equal(pcg.variant, 'pcg32')
  })

  test('preserves the variant tag across JSON round-trips', () => {
    const pcg = createPcg({}, 42, 54)
    const revived = JSON.parse(JSON.stringify(pcg))
    assert.equal(revived.variant, 'pcg32')
  })
})

describe('createPcg alias', () => {
  test('createPcg is the same function as createPcg32', () => {
    assert.equal(createPcg, createPcg32)
  })

  test('createPcg and createPcg32 produce identical state for the same seed', () => {
    const a = createPcg({}, 42, 54)
    const b = createPcg32({}, 42, 54)
    assert.deepEqual(b, a)
    const rng = randomInt(0, 2 ** 32 - 1)
    assert.equal(rng(b)[0], rng(a)[0])
  })
})
