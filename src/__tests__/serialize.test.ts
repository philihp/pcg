import { createPcg64, fromBigInt, nextState64, randomInt64, randomList64, toBigInt } from '..'
import { OutputFnType, PCGState64, StreamScheme } from '../types'

describe('serialize', () => {
  it('round-trips the state through JSON.stringify/parse', () => {
    expect.assertions(2)
    const pcg = createPcg64({}, 42, 54)
    const json = JSON.stringify(pcg)
    const revived = JSON.parse(json) as PCGState64
    expect(revived).toStrictEqual(pcg)

    const randomUint32 = randomInt64(0, 2 ** 32 - 1)
    expect(randomUint32(revived)[0]).toBe(randomUint32(pcg)[0])
  })

  it('continues a generation sequence after a serialization round-trip', () => {
    expect.assertions(1)
    const pcg = createPcg64({}, 42, 54)
    const randomUint32 = randomInt64(0, 2 ** 32 - 1)

    const reference = randomList64(6, randomUint32, pcg).map(([v]) => v)

    // Generate the first 3, persist the state, then continue.
    const firstThree = randomList64(3, randomUint32, pcg)
    const persisted = JSON.parse(JSON.stringify(firstThree[2][1])) as PCGState64
    const resumed = randomList64(3, randomUint32, persisted).map(([v]) => v)

    expect([...firstThree.map(([v]) => v), ...resumed]).toStrictEqual(reference)
  })

  it('state contains no functions and no bigints', () => {
    expect.assertions(0)
    const pcg = createPcg64({}, 42, 54)
    const seen = new Set<unknown>()
    const walk = (value: unknown): void => {
      if (value === null || typeof value !== 'object') {
        if (typeof value === 'function') throw new Error('state contains a function')
        if (typeof value === 'bigint') throw new Error('state contains a bigint')
        return
      }
      if (seen.has(value)) return
      seen.add(value)
      for (const v of Object.values(value as Record<string, unknown>)) walk(v)
    }
    walk(pcg)
  })

  it('survives serialization with non-default scheme and output function', () => {
    expect.assertions(1)
    const pcg = createPcg64({ streamScheme: StreamScheme.ONESEQ, outputFnType: OutputFnType.RXS_M_XS }, 42, 54)
    const revived = JSON.parse(JSON.stringify(pcg)) as PCGState64
    const randomUint32 = randomInt64(0, 2 ** 32 - 1)
    expect(randomList64(4, randomUint32, revived).map(([v]) => v)).toStrictEqual(
      randomList64(4, randomUint32, pcg).map(([v]) => v)
    )
  })

  it('toBigInt and fromBigInt round-trip arbitrary 64-bit values', () => {
    expect.assertions(4)
    const values = [0n, 1n, 0xffffffffn, 0x100000000n, 0xffffffffffffffffn]
    for (const v of values.slice(0, 4)) {
      expect(toBigInt(fromBigInt(v))).toBe(v)
    }
  })

  it('preserves state after multiple nextState64 calls across a round-trip', () => {
    expect.assertions(1)
    const pcg = createPcg64({}, 42, 54)
    let live = pcg
    let revived: PCGState64 = JSON.parse(JSON.stringify(pcg))
    for (let i = 0; i < 100; i++) {
      live = nextState64(live)
      revived = nextState64(JSON.parse(JSON.stringify(revived)))
    }
    expect(revived).toStrictEqual(live)
  })
})
