import { OutputFnType, PCGState, StreamScheme } from './types'

// Tommy Ettinger's mulberry32: a 32-bit counter-based PRNG with a period of
// 2^32. Compact and fast, but with much weaker statistical properties and a
// far shorter period than any PCG variant; use it where ergonomics and speed
// matter more than stream quality.
const MULBERRY_INCREMENT = 0x6d2b79f5

export const mulberry32Advance = (pcg: PCGState, delta: number): PCGState => ({
  ...pcg,
  state: { hi: 0, lo: (pcg.state.lo + Math.imul(delta, MULBERRY_INCREMENT)) >>> 0 },
})

export const mulberry32Output = (pcg: PCGState): number => {
  const { lo } = pcg.state
  let t = Math.imul(lo ^ (lo >>> 15), lo | 1)
  t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0
  return (t ^ (t >>> 14)) >>> 0
}

export const createMulberry32 = (seed: bigint | number | string): PCGState => {
  const seedLo = Number(BigInt(seed) & 0xffffffffn)
  return {
    state: { hi: 0, lo: (seedLo + MULBERRY_INCREMENT) >>> 0 },
    streamId: { hi: 0, lo: 0 },
    variant: 'mulberry32',
    outputFnType: OutputFnType.XSH_RR,
    streamScheme: StreamScheme.SETSEQ,
  }
}
