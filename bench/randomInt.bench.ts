/* eslint-disable no-console */
// Micro-benchmark comparing the BigInt-backed `createPcg64` path against the
// default BigInt-free `createPcg32` path. Run with:
//   npm run bench

import { createPcg32, randomUint32 } from '../src/pcg32'
import { createPcg64, nextState64, getOutput64, randomInt64 } from '../src'

type BenchResult = { name: string; iterations: number; ms: number; opsPerSec: number; checksum: number }

const bench = (name: string, iterations: number, fn: () => number): BenchResult => {
  // Warm-up pass so the JIT compiles the hot path before we time it.
  fn()
  const start = process.hrtime.bigint()
  const checksum = fn()
  const end = process.hrtime.bigint()
  const ms = Number(end - start) / 1e6
  return { name, iterations, ms, opsPerSec: (iterations / ms) * 1000, checksum }
}

const ITERATIONS = 1_000_000

const benchSlowNextState = (): BenchResult =>
  bench('createPcg64 nextState64', ITERATIONS, () => {
    let pcg = createPcg64({}, 42, 54)
    let acc = 0
    for (let i = 0; i < ITERATIONS; i++) {
      pcg = nextState64(pcg)
      acc = (acc + getOutput64(pcg)) >>> 0
    }
    return acc
  })

const benchFastNextState = (): BenchResult =>
  bench('createPcg32 randomUint32', ITERATIONS, () => {
    let pcg = createPcg32(42, 54)
    let acc = 0
    for (let i = 0; i < ITERATIONS; i++) {
      const [v, next] = randomUint32(pcg)
      pcg = next
      acc = (acc + v) >>> 0
    }
    return acc
  })

const benchSlowRandomInt = (): BenchResult => {
  const u32 = randomInt64(0, 2 ** 32 - 1)
  return bench('createPcg64 randomInt64', ITERATIONS, () => {
    let pcg = createPcg64({}, 42, 54)
    let acc = 0
    for (let i = 0; i < ITERATIONS; i++) {
      const [v, next] = u32(pcg)
      pcg = next
      acc = (acc + v) >>> 0
    }
    return acc
  })
}

const benchFastRandomInt = (): BenchResult =>
  bench('createPcg32 randomUint32', ITERATIONS, () => {
    let pcg = createPcg32(42, 54)
    let acc = 0
    for (let i = 0; i < ITERATIONS; i++) {
      const [v, next] = randomUint32(pcg)
      pcg = next
      acc = (acc + v) >>> 0
    }
    return acc
  })

const fmt = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 0 })

const report = (rows: BenchResult[]): void => {
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(30)} ${fmt(r.iterations).padStart(12)} ops  ${fmt(r.ms).padStart(8)} ms  ` +
        `${fmt(r.opsPerSec).padStart(14)} ops/s  checksum=${r.checksum}`
    )
  }
}

const slowStep = benchSlowNextState()
const fastStep = benchFastNextState()
const slowRand = benchSlowRandomInt()
const fastRand = benchFastRandomInt()

report([slowStep, fastStep, slowRand, fastRand])

console.log(`\nspeedup (nextState):    ${(fastStep.opsPerSec / slowStep.opsPerSec).toFixed(2)}x`)
console.log(`speedup (randomInt):    ${(fastRand.opsPerSec / slowRand.opsPerSec).toFixed(2)}x`)
