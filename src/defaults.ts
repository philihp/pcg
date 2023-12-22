import Long from 'long'
import { StreamScheme, OutputFnType } from './types'

// export const pcgDefaultIncrement8 = 77
// export const pcgDefaultIncrement16 = 47989
// export const pcgDefaultIncrement32 = Long.fromString('2891336453', 10)
export const pcgDefaultIncrement64 = Long.fromString('1442695040888963407', 10)

// export const pcgDefaultMultiplier8 = 141
// export const pcgDefaultMultiplier16 = 12829
// export const pcgDefaultMultiplier32 = Long.fromString('747796405')
export const pcgDefaultMultiplier64 = Long.fromString('6364136223846793005', 10)

export const pcgDefaultOutputFnType: OutputFnType = OutputFnType.XSH_RR
export const pcgDefaultStreamScheme: StreamScheme = StreamScheme.SETSEQ
