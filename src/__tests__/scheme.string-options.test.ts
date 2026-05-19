import { createPcg32 } from '..'
import { StreamScheme } from '../types'

describe('streamScheme accepts a string name', () => {
  it.each(['SETSEQ', 'ONESEQ', 'MCG', 'MULBERRY32', 'SFC32'] as const)('matches the enum for %s', (name) => {
    const fromString = createPcg32({ streamScheme: name }, 42, 54)
    const fromEnum = createPcg32({ streamScheme: StreamScheme[name] }, 42, 54)
    expect(fromString).toStrictEqual(fromEnum)
    expect(fromString.streamScheme).toBe(StreamScheme[name])
  })

  it('throws on an unknown scheme name', () => {
    expect(() =>
      // @ts-expect-error - intentionally invalid name
      createPcg32({ streamScheme: 'NOPE' }, 42, 54)
    ).toThrow(/Unknown stream scheme/)
  })
})
