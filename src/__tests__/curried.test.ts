import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createPcg32, randomInt, randomList } from '..'
import { OutputFnType, StreamScheme } from '..'

describe('curried APIs', () => {
  const pcg = createPcg32({}, 42, 54)
  const directRng = randomInt(0, 2 ** 32 - 1)
  const expected = directRng(pcg)

  test('randomInt(min)(max)(pcg) is equivalent to randomInt(min, max, pcg)', () => {
    const partial = randomInt(0)
    const ranger = partial(2 ** 32 - 1)
    const [value, next] = ranger(pcg)
    assert.equal(value, expected[0])
    assert.deepEqual(next, expected[1])
  })

  test('randomInt(min)(max, pcg) is equivalent to randomInt(min, max, pcg)', () => {
    const partial = randomInt(0)
    const [value, next] = partial(2 ** 32 - 1, pcg)
    assert.equal(value, expected[0])
    assert.deepEqual(next, expected[1])
  })

  test('randomList(length)(rng)(pcg) is equivalent to randomList(length, rng, pcg)', () => {
    const expectedList = randomList(3, directRng, pcg)
    const list = randomList(3)<number>(directRng)(pcg)
    assert.deepEqual(list, expectedList)
  })

  test('randomList(length)(rng, pcg) is equivalent to randomList(length, rng, pcg)', () => {
    const expectedList = randomList(3, directRng, pcg)
    const list = randomList(3)<number>(directRng, pcg)
    assert.deepEqual(list, expectedList)
  })

  test('randomList(length, rng)(pcg) is equivalent to randomList(length, rng, pcg)', () => {
    const expectedList = randomList(3, directRng, pcg)
    const list = randomList(3, directRng)(pcg)
    assert.deepEqual(list, expectedList)
  })

  test('randomList of zero length returns an empty array', () => {
    assert.deepEqual(randomList(0, directRng, pcg), [])
  })

  test('exposes OutputFnType and StreamScheme from the package entry point', () => {
    assert.notEqual(OutputFnType.XSH_RR, undefined)
    assert.notEqual(StreamScheme.SETSEQ, undefined)
  })
})
