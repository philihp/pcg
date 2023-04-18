import { ror32 } from './bitwise'
import { pcgDefaultIncrement64, pcgDefaultMultiplier64 } from './defaults'
import { XSH_RR } from './enums/OutputFnType'
import createPcg from './createPcg'

export default createPcg({
  numOutputBits: 32,
  multiplier: pcgDefaultMultiplier64,
  increment: pcgDefaultIncrement64,
  outputFns: {
    [XSH_RR]() {
      return ror32(this.state.shru(59).toInt(), this.state.shru(18).xor(this.state).shru(27).toInt())
    },
  },
})
