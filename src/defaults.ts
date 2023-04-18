import Long from 'long'
import { StreamScheme, OutputFnType } from './types'

// export const pcgDefaultIncrement8 = 77;
// export const pcgDefaultIncrement16 = 47989;
// export const pcgDefaultIncrement32 = 2891336453;
export const pcgDefaultIncrement64 = Long.fromString('1442695040888963407', true)

// export const pcgDefaultMultiplier8 = 141;
// export const pcgDefaultMultiplier16 = 12829;
// export const pcgDefaultMultiplier32 = 747796405;
export const pcgDefaultMultiplier64 = Long.fromString('6364136223846793005', true)

export const pcgDefaultOutputFnType: OutputFnType = OutputFnType.XSH_RR
export const pcgDefaultStreamScheme: StreamScheme = StreamScheme.SETSEQ
