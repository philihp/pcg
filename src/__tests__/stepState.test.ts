import { createPcg64, nextState64, stepState64, randomInt64 } from '..'

describe('stepState64', () => {
  it('can step forward multiple states', () => {
    expect.assertions(1)
    const random = randomInt64(0, 2 ** 32 - 1)
    const s0 = createPcg64({}, 42, 54)

    const s1 = nextState64(s0)
    const s2 = nextState64(s1)
    const s3 = nextState64(s2)
    const s4 = nextState64(s3)
    const q4 = stepState64(4, s0)
    expect(random(s4)[0]).toBe(random(q4)[0])
  })
})
