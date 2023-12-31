import { ror, ror8, ror16, ror32 } from '../bitwise'

describe('bitwise', () => {
  describe('ror32', () => {
    it('works', () => {
      expect.assertions(1)
      expect(true).toBeTruthy()
    })
    it('shifts 54 by 42', () => {
      expect.assertions(1)
      const out = ror32(54, 42)
      expect(out).toBe(43008)
    })
    it('shifts -54 by 42', () => {
      expect.assertions(1)
      expect(ror32(-54, 42)).toBe(176160768)
    })
    it('shifts 54 by -42', () => {
      expect.assertions(1)
      expect(ror32(54, -42)).toBe(4294925311)
    })
    it('shifts -54 by -42', () => {
      expect.assertions(1)
      expect(ror32(-54, -42)).toBe(4123000831)
    })
  })
})
