import { createPcg32, nextState, stepState, randomInt } from '..'

describe('stepState', () => {
  it('can step forward multiple states', () => {
    expect.assertions(1)
    const random = randomInt(0, 2 ** 32 - 1)
    const s0 = createPcg32({}, 42, 54)

    const s1 = nextState(s0)
    const s2 = nextState(s1)
    const s3 = nextState(s2)
    const s4 = nextState(s3)
    const q4 = stepState(4, s0)
    expect(random(s4)[0]).toBe(random(q4)[0])
  })
})
