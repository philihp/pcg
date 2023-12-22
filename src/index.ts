import Long from 'long'
import { ror32 } from './bitwise'
import { pcgDefaultIncrement64, pcgDefaultMultiplier64 } from './defaults'
import { OutputFnType } from './types'
import createPcg from './createPcg'

export { stepState, nextState, prevState, randomInt, randomList } from './createPcg'

export const createPcg32 = createPcg({
  numOutputBits: 32,
  multiplier: pcgDefaultMultiplier64,
  increment: pcgDefaultIncrement64,
  outputFns: {
    [OutputFnType.XSH_RR]: (state: Long): number =>
      ror32(state.shru(59).toInt(), state.shru(18).xor(state).shru(27).toInt()),
    [OutputFnType.XSH_RS]: (state: Long): number => state.shru(22).xor(state).shru(state.shru(61).add(22)).toInt(),
    [OutputFnType.XSL_RR]: (state: Long): number => ror32(state.shru(59).toInt(), state.shru(32).xor(state).toInt()),
    // [OutputFnType.XSL_RR_RR]: (state: Long): number => {
    //   const high = state.shru(32)
    //   const newlow = ror32(state.shru(59).toInt(), high.xor(state).toInt())
    //   return new Long(ror32(new Long(newlow).and(32).toInt(), high.toInt())).shl(32).or(newlow).toInt()
    // },
    [OutputFnType.RXS_M_XS]: (state: Long): number => {
      const word = state.shru(13).add(3).xor(state).mul(62169)
      return word.shru(11).xor(word).toInt()
    },
  },
})
