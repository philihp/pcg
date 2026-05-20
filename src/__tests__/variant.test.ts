import { createPcg, createPcg32, nextState, randomInt } from '..'

describe('PCGVariant tag', () => {
  it('stamps new state objects with variant: "pcg32"', () => {
    expect.assertions(1)
    const pcg = createPcg({}, 42, 54)
    expect(pcg.variant).toBe('pcg32')
  })

  it('preserves the variant tag across nextState', () => {
    expect.assertions(1)
    let pcg = createPcg({}, 42, 54)
    for (let i = 0; i < 10; i++) pcg = nextState(pcg)
    expect(pcg.variant).toBe('pcg32')
  })

  it('preserves the variant tag across JSON round-trips', () => {
    expect.assertions(1)
    const pcg = createPcg({}, 42, 54)
    const revived = JSON.parse(JSON.stringify(pcg))
    expect(revived.variant).toBe('pcg32')
  })
})

describe('createPcg alias', () => {
  it('createPcg is the same function as createPcg32', () => {
    expect.assertions(1)
    expect(createPcg).toBe(createPcg32)
  })

  it('createPcg and createPcg32 produce identical state for the same seed', () => {
    expect.assertions(2)
    const a = createPcg({}, 42, 54)
    const b = createPcg32({}, 42, 54)
    expect(b).toEqual(a)
    const rng = randomInt(0, 2 ** 32 - 1)
    expect(rng(b)[0]).toBe(rng(a)[0])
  })
})
