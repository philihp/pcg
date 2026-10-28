import { StreamScheme, OutputFnType } from './types'

export const pcgDefaultIncrement64 = 1442695040888963407n
export const pcgDefaultMultiplier64 = 6364136223846793005n

// Inverse of the multiplier mod 2^64 (their product is 1 mod 2^64). Stepping
// back one state is one multiply by this instead of a 64-round jump-ahead.
export const pcgDefaultMultiplierInverse64 = 13877824140714322085n

export const pcgDefaultOutputFnType: OutputFnType = OutputFnType.XSH_RR
export const pcgDefaultStreamScheme: StreamScheme = StreamScheme.SETSEQ
