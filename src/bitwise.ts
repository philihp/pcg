export const ror = (numBits: number) => (shift: number, value: number) =>
  ((value >>> shift) | (value << (-shift & (numBits - 1)))) >>> 0

export const ror8 = ror(8)
export const ror16 = ror(16)
export const ror32 = ror(32)
