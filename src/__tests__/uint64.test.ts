import { add64, fromBigInt, fromNumber, mul64, toBigInt } from '../uint64'

const MASK_64 = 0xffffffffffffffffn

describe('uint64', () => {
  describe('fromNumber', () => {
    it('encodes zero', () => {
      expect(fromNumber(0)).toEqual({ hi: 0, lo: 0 })
    })

    it('encodes small positive integers', () => {
      expect(fromNumber(1)).toEqual({ hi: 0, lo: 1 })
      expect(fromNumber(0x1234)).toEqual({ hi: 0, lo: 0x1234 })
    })

    it('encodes the 32-bit boundary', () => {
      expect(fromNumber(0xffffffff)).toEqual({ hi: 0, lo: 0xffffffff })
      expect(fromNumber(0x100000000)).toEqual({ hi: 1, lo: 0 })
    })

    it('encodes -1 as the all-ones two\'s complement word', () => {
      expect(fromNumber(-1)).toEqual({ hi: 0xffffffff, lo: 0xffffffff })
    })

    it('encodes -2 correctly', () => {
      expect(fromNumber(-2)).toEqual({ hi: 0xffffffff, lo: 0xfffffffe })
    })

    it('agrees with fromBigInt for representable signed values', () => {
      const samples = [0, 1, 7, -1, -7, 0xffffffff, -0xffffffff, 0x100000000, -0x100000000]
      for (const n of samples) {
        const big = (BigInt(n) + (1n << 64n)) & MASK_64
        expect(fromNumber(n)).toEqual(fromBigInt(big))
      }
    })
  })

  describe('toBigInt / fromBigInt round-trip', () => {
    it('survives full 64-bit values', () => {
      const samples = [0n, 1n, 0x80000000n, 0xffffffffn, 0x100000000n, 0xdeadbeefcafebaben, MASK_64]
      for (const v of samples) {
        expect(toBigInt(fromBigInt(v))).toBe(v)
      }
    })
  })

  describe('add64', () => {
    it('adds without carry', () => {
      expect(add64({ hi: 0, lo: 3 }, { hi: 0, lo: 4 })).toEqual({ hi: 0, lo: 7 })
    })

    it('propagates carry from lo to hi', () => {
      expect(add64({ hi: 0, lo: 0xffffffff }, { hi: 0, lo: 1 })).toEqual({ hi: 1, lo: 0 })
    })

    it('wraps modulo 2^64', () => {
      const allOnes = { hi: 0xffffffff, lo: 0xffffffff }
      expect(add64(allOnes, { hi: 0, lo: 1 })).toEqual({ hi: 0, lo: 0 })
    })

    it('matches BigInt addition over a sweep', () => {
      const samples: bigint[] = [
        0n,
        1n,
        0xffffffffn,
        0x100000000n,
        0xdeadbeefn,
        0x1234567890abcdefn,
        MASK_64,
        MASK_64 - 7n,
      ]
      for (const a of samples) {
        for (const b of samples) {
          const expected = fromBigInt((a + b) & MASK_64)
          expect(add64(fromBigInt(a), fromBigInt(b))).toEqual(expected)
        }
      }
    })
  })

  describe('mul64', () => {
    it('multiplies small values', () => {
      expect(mul64({ hi: 0, lo: 3 }, { hi: 0, lo: 4 })).toEqual({ hi: 0, lo: 12 })
    })

    it('produces carry into the hi half', () => {
      const a = fromBigInt(0xffffffffn)
      const b = fromBigInt(0xffffffffn)
      expect(mul64(a, b)).toEqual(fromBigInt((0xffffffffn * 0xffffffffn) & MASK_64))
    })

    it('wraps modulo 2^64', () => {
      const a = fromBigInt(MASK_64)
      const b = fromBigInt(MASK_64)
      expect(mul64(a, b)).toEqual(fromBigInt((MASK_64 * MASK_64) & MASK_64))
    })

    it('matches BigInt multiplication for the PCG multiplier constants', () => {
      const samples: bigint[] = [
        0n,
        1n,
        6364136223846793005n,
        1442695040888963407n,
        0xdeadbeefcafebaben,
        0x1234567890abcdefn,
        MASK_64,
      ]
      for (const a of samples) {
        for (const b of samples) {
          const expected = fromBigInt((a * b) & MASK_64)
          expect(mul64(fromBigInt(a), fromBigInt(b))).toEqual(expected)
        }
      }
    })

    it('matches BigInt for a pseudo-random sweep', () => {
      // Self-contained pseudo-random sweep so we don't depend on the module under test
      // to drive its own correctness check.
      let s = 0x9e3779b97f4a7c15n
      const next = (): bigint => {
        s = (s * 6364136223846793005n + 1442695040888963407n) & MASK_64
        return s
      }
      for (let i = 0; i < 200; i++) {
        const a = next()
        const b = next()
        const expected = fromBigInt((a * b) & MASK_64)
        expect(mul64(fromBigInt(a), fromBigInt(b))).toEqual(expected)
      }
    })
  })
})
