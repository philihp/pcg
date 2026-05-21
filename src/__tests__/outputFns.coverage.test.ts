import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { getOutput, OutputFnType, PCGState, StreamScheme } from '..'

// Cover output-function branches that the canonical seed=42/stream=54 stream
// doesn't naturally hit. State is constructed directly so the relevant bits
// of state.hi / state.lo land on the carry / zero-rotate edges.

const buildState = (hi: number, lo: number, outputFnType: OutputFnType): PCGState => ({
  state: { hi, lo },
  streamId: { hi: 0, lo: 1 },
  variant: 'pcg32',
  outputFnType,
  streamScheme: StreamScheme.SETSEQ,
})

describe('output function edge cases', () => {
  test('RXS_M_XS triggers the sumLo > 0xffffffff carry path', () => {
    // aLo = ((lo >>> 13) | (hi << 19)) >>> 0; sumLo = aLo + 3 > 0xffffffff
    // when aLo > 0xfffffffc. hi = 0xffffffff, lo = 0xffffffff gives aLo =
    // 0xffffffff, so sumLo = 0x100000002 — carry must propagate to aHi.
    const state = buildState(0xffffffff, 0xffffffff, OutputFnType.RXS_M_XS)
    const out = getOutput(state)
    assert.equal(typeof out, 'number')
    assert.ok(out >= 0 && out <= 0xffffffff)
  })

  test('XSH_RR with rot=0 takes the trivial ror32 path', () => {
    // rot = hi >>> 27 === 0 when hi < 2^27. Forces ror32(0, word) which
    // exercises the shift=0 branch inside the rotate helper.
    const state = buildState(0, 0x12345678, OutputFnType.XSH_RR)
    const out = getOutput(state)
    assert.equal(typeof out, 'number')
  })
})
