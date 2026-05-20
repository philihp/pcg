import { mulAdd64, mul64, numberToU64 } from './uint64'

// Default PCG32. BigInt-free; opinionated on the configuration:
//   - Stream scheme: SETSEQ (one stream per streamId)
//   - Output function: XSH_RR
// For different schemes or output functions, see the BigInt-backed
// `createPcg64` API.
//
// Seeds are plain JS numbers (32-bit unsigned range). PCG32 must never
// touch BigInt — that is reserved for the 64-bit API.

// 6364136223846793005 = 0x5851F42D4C957F2D
const MUL_HI = 0x5851f42d
const MUL_LO = 0x4c957f2d

export type PCGState32 = {
  sHi: number
  sLo: number
  iHi: number
  iLo: number
}

const setseqIncrement = (initStreamId: number): { hi: number; lo: number } => {
  // streamId = ((id << 1) | 1) mod 2^64
  const u = numberToU64(initStreamId)
  const hi = ((u.hi << 1) | (u.lo >>> 31)) >>> 0
  const lo = ((u.lo << 1) | 1) >>> 0
  return { hi, lo }
}

export const createPcg32 = (initState: number, initStreamId: number): PCGState32 => {
  const inc = setseqIncrement(initStreamId)

  // state = nextState((streamId + initState) mod 2^64)
  const s = numberToU64(initState)
  const sumLo = inc.lo + s.lo
  const carry = sumLo > 0xffffffff ? 1 : 0
  const seedHi = (inc.hi + s.hi + carry) >>> 0
  const seedLo = sumLo >>> 0

  const next = mulAdd64(seedHi, seedLo, MUL_HI, MUL_LO, inc.hi, inc.lo)
  return { sHi: next.hi, sLo: next.lo, iHi: inc.hi, iLo: inc.lo }
}

export const nextState = (pcg: PCGState32): PCGState32 => {
  // Inlined mulAdd64 with constant multiplier to avoid splitting it every call.
  const sHi = pcg.sHi
  const sLo = pcg.sLo
  const iHi = pcg.iHi
  const iLo = pcg.iLo

  const a0 = sLo & 0xffff
  const a1 = sLo >>> 16
  const a2 = sHi & 0xffff
  const a3 = sHi >>> 16

  const c0 = a0 * 0x7f2d + (iLo & 0xffff)
  let c1 = (c0 >>> 16) + a1 * 0x7f2d + (iLo >>> 16)
  let c2 = c1 >>> 16
  c1 = (c1 & 0xffff) + a0 * 0x4c95
  c2 += c1 >>> 16
  let c3 = c2 >>> 16
  c2 = (c2 & 0xffff) + a2 * 0x7f2d + (iHi & 0xffff)
  c3 += c2 >>> 16
  c2 = (c2 & 0xffff) + a1 * 0x4c95
  c3 += c2 >>> 16
  c2 = (c2 & 0xffff) + a0 * 0xf42d
  c3 += c2 >>> 16
  c3 = (c3 & 0xffff) + a3 * 0x7f2d + a2 * 0x4c95 + a1 * 0xf42d + a0 * 0x5851 + (iHi >>> 16)

  return {
    sHi: (((c3 & 0xffff) << 16) | (c2 & 0xffff)) >>> 0,
    sLo: (((c1 & 0xffff) << 16) | (c0 & 0xffff)) >>> 0,
    iHi,
    iLo,
  }
}

// XSH_RR output.
export const getOutput = (pcg: PCGState32): number => {
  const h = pcg.sHi
  const l = pcg.sLo
  const rot = h >>> 27
  const xh = ((h >>> 18) ^ h) >>> 0
  const xl = ((((h << 14) | (l >>> 18)) >>> 0) ^ l) >>> 0
  const val = ((xh << 5) | (xl >>> 27)) >>> 0
  return ((val >>> rot) | (val << (-rot & 31))) >>> 0
}

export const randomInt = (min: number, max: number, pcg: PCGState32): [number, PCGState32] => {
  const bound = max - min
  if (bound < 0 || bound > 0x100000000) throw new RangeError()
  const threshold = (0x100000000 - bound) % bound

  let curr = pcg
  let n: number
  do {
    n = getOutput(curr)
    curr = nextState(curr)
  } while (n < threshold)
  return [(n % bound) + min, curr]
}

// Convenience: full 32-bit unsigned range, no rejection sampling required.
export const randomUint32 = (pcg: PCGState32): [number, PCGState32] => [getOutput(pcg), nextState(pcg)]

export type RandomFn<T> = (pcg: PCGState32) => [T, PCGState32]

export const randomList = <T>(length: number, rng: RandomFn<T>, initPcg: PCGState32): [T, PCGState32][] => {
  if (length <= 0) return []
  const result: [T, PCGState32][] = new Array(length)
  let curr = rng(initPcg)
  result[0] = curr
  for (let i = 1; i < length; i++) {
    curr = rng(curr[1])
    result[i] = curr
  }
  return result
}

// Multi-step advance via Brown (1994), translated to {hi, lo} math.
export const stepState = (delta: number, pcg: PCGState32): PCGState32 => {
  let currMulHi = MUL_HI
  let currMulLo = MUL_LO
  let currIncHi = pcg.iHi
  let currIncLo = pcg.iLo

  let accMulHi = 0
  let accMulLo = 1
  let accIncHi = 0
  let accIncLo = 0

  const d = numberToU64(delta)
  let dHi = d.hi
  let dLo = d.lo

  while (dHi !== 0 || dLo !== 0) {
    if ((dLo & 1) === 1) {
      const am = mul64(accMulHi, accMulLo, currMulHi, currMulLo)
      accMulHi = am.hi
      accMulLo = am.lo

      const ai = mulAdd64(accIncHi, accIncLo, currMulHi, currMulLo, currIncHi, currIncLo)
      accIncHi = ai.hi
      accIncLo = ai.lo
    }

    const mp1Lo = (currMulLo + 1) >>> 0
    const mp1Hi = currMulLo === 0xffffffff ? ((currMulHi + 1) >>> 0) : currMulHi
    const ci = mul64(currIncHi, currIncLo, mp1Hi, mp1Lo)
    currIncHi = ci.hi
    currIncLo = ci.lo

    const cm = mul64(currMulHi, currMulLo, currMulHi, currMulLo)
    currMulHi = cm.hi
    currMulLo = cm.lo

    dLo = ((dLo >>> 1) | ((dHi & 1) << 31)) >>> 0
    dHi = dHi >>> 1
  }

  const r = mulAdd64(pcg.sHi, pcg.sLo, accMulHi, accMulLo, accIncHi, accIncLo)
  return { sHi: r.hi, sLo: r.lo, iHi: pcg.iHi, iLo: pcg.iLo }
}

export const prevState = (pcg: PCGState32): PCGState32 => stepState(-1, pcg)
