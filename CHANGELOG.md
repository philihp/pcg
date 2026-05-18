# Changelog

## 2.0.0

### Breaking changes

- **`PCGState` shape changed to be JSON-serializable** (#179, #330). The 64-bit
  `state` and `streamId` fields are now `{ hi: number, lo: number }` objects
  (`Uint64`) instead of native `bigint`s. Consumers that persisted v1.x state
  via `JSON.stringify` / structured clone must migrate; raw bigint state from
  v1.x will not round-trip.
- **Public typings tightened** (#240, #318, #319, #320). `createPcg32`'s return
  type is now a nameable `PCGState` rather than an inferred anonymous type.
  Code that relied on the previous inferred shape may need to import
  `PCGState` explicitly.
- **Minimum Node.js version is now 16.** Declared via `engines.node`.

### Performance

- ~7× faster `randomInt` / `nextState` / `randomList` hot path (#328).
- Scheme→increment dispatch moved into the PCG config (#331).

### Fixes

- `randomInt` now allows a bound equal to `outputMaxRange` (#329).

### Build / tooling

- Switched from `tsc` to `tsup` for dual ESM/CJS output (#317).
- Upgraded to TypeScript 6, ESLint 9 (flat config), and the Node 24 tsconfig
  base. CI matrix now covers Node 22 and 24.

## 1.1.0

See git history.
