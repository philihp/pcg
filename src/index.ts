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
  },
})
