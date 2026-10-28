import type { PCGState, Uint64 } from './types'

// A copy of `pcg` holding new registers. Spelled out as a literal rather than
// a spread so every state the library returns has the same shape, which keeps
// the hot paths monomorphic. The input is never touched.
export const withState = (pcg: PCGState, state: Uint64, streamId: Uint64 = pcg.streamId): PCGState => ({
  state,
  streamId,
  variant: pcg.variant,
  outputFnType: pcg.outputFnType,
  streamScheme: pcg.streamScheme,
})
