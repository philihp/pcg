# Changelog

## Unreleased

### Breaking changes

- **Minimum Node.js version raised from `>=18` to `>=22`.** Node 18 and 20
  are both EOL; 22 is the oldest line still in maintenance. Consumers on
  Node 18/20 should stay on 3.x.
- **`OutputFnType` and `StreamScheme` are now `const` objects instead of
  `enum`s.** Both are still exported as a value and as a type, so
  `StreamScheme.MCG`, `StreamScheme['MCG']`, and `streamScheme: StreamScheme`
  all keep working. What no longer works is the enum reverse mapping
  (`StreamScheme[0] === 'SETSEQ'`), and the types are now unions of their
  numeric literals rather than nominal enum types, so plain numbers are
  accepted where an enum member was previously required.

### Tooling

- Upgraded to TypeScript 7, the native compiler. Type checking now runs as
  its own `npm run typecheck` step in CI.
- Replaced `tsup` with `tsdown` (rolldown) for the dual ESM/CJS build.
  Output filenames are unchanged.
- Replaced `eslint` / `typescript-eslint` with `oxlint`, configured in
  `.oxlintrc.json`.
- The source is now `erasableSyntaxOnly`, `verbatimModuleSyntax`, and
  `isolatedModules` clean, and type checks with `noUncheckedIndexedAccess`.
- Bumped `@types/node` to `^26` and rebased `tsconfig.json` on
  `@tsconfig/node22`.
- CI matrix moved to Node 22/24/26.

## 3.0.0

### Breaking changes

- **Minimum Node.js version raised from `>=16` to `>=18`.** Node 16 has
  been EOL since September 2023; Node 18 is the lowest line still in any
  kind of common deployment. Consumers on Node 16 should stay on 2.x.

### Features

- Added `mulberry32` as an additional generator variant (#338).
  `createMulberry32(seed)` produces a `PCGState` tagged with
  `variant: 'mulberry32'` that works with the existing `nextState`,
  `getOutput`, `randomInt`, `randomList`, and `stepState` functions.
- Added `sfc32` as an additional generator variant (#340).
  `createSfc32(seed)` produces a `PCGState` tagged with `variant: 'sfc32'`.
  Note: sfc32 is not reversible — `prevState` and negative `stepState`
  deltas throw.
- Added a `createPcg` alias for `createPcg32` (#339), and re-exported all
  factories from the package entry point.

### Tooling

- Migrated the test suite from `jest` to the built-in `node:test` runner
  (#342). No behavior change for consumers; dev iteration is faster and
  the dependency footprint shrinks.
- Dropped unused `husky` / `lint-staged` dev dependencies. Linting still
  runs in CI.
- Pinned `@types/node` to `^24` to match the `@tsconfig/node24` base.

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
