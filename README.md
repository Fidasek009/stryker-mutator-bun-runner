# stryker-mutator-bun-runner

A Bun test runner plugin for StrykerJS. It executes `bun test` with Bun 1.4.4 or
newer and supports Stryker 10.1.1.

## Install and run

```sh
bun add --dev @stryker-mutator/core@10.1.1 stryker-mutator-bun-runner
```

Create `stryker.config.json`:

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "bun",
  "plugins": ["stryker-mutator-bun-runner"],
  "mutate": ["src/**/*.ts", "!src/**/*.test.ts"],
  "coverageAnalysis": "perTest",
  "concurrency": 2,
  "reporters": ["clear-text", "html"],
  "bun": {
    "testFiles": ["test/**/*.test.ts"],
    "timeout": 5000
  }
}
```

Run Stryker and its workers with Bun. Do not use `npx` or a Node shebang.

```sh
bun node_modules/@stryker-mutator/core/bin/stryker.js run
```

Stryker's `packageManager` schema only accepts `npm`, `yarn`, and `pnpm`. Leave
it unset when dependencies already exist. It does not prevent the project itself
from using Bun.

## Behavior

- The runner starts a fresh Bun process for every dry run and mutant run. Test
  state, active mutants, module caches, globals, snapshots, and environment
  changes cannot carry into another run. Stryker can still schedule independent
  processes concurrently.
- Bun's JUnit reporter supplies test IDs, file names, locations, durations,
  failures, and skips. A failing assertion kills a mutant. Passing executed
  tests allow a covered mutation to survive.
- A nonzero run with an import error, a process crash, or zero executed tests
  returns an error instead of a survival. An empty `testFilter` means Stryker
  found no covering tests and does not start Bun.
- With `coverageAnalysis` set to `perTest`, a preload wraps Bun's test
  registration functions and writes `__stryker__.currentTestId` in the child
  process. Stryker uses that coverage to pass `testFilter`; the runner turns
  test IDs into an escaped `--test-name-pattern` expression.
- With `coverageAnalysis` set to `all`, the preload reports static coverage
  without per-test attribution. `off` skips coverage collection.
- Runtime mutants activate in a `beforeAll` hook after imports. Static mutants
  use `__STRYKER_ACTIVE_MUTANT__` from process startup so they are active during
  imports.
- Every run has an overall `Bun.spawn` abort timeout and `--no-orphans`.
  `bun.timeout` controls Bun's per-test timeout. Disposal aborts any remaining
  child.

## Options

| Option            | Type                     | Default       | Description                                                                                                                                          |
| ----------------- | ------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `testFiles`       | `string[]`               | Bun discovery | Exact paths or glob patterns. Globs must match at least one file.                                                                                    |
| `timeout`         | `number`                 | `5000`        | Bun's timeout for each test, in milliseconds.                                                                                                        |
| `bail`            | `boolean`                | `false`       | Stop the dry run at its first failure. Mutant runs bail unless Stryker sets `disableBail`.                                                           |
| `bunArgs`         | `string[]`               | `[]`          | Extra `bun test` flags, for example `["--randomize", "--seed=42"]`.                                                                                  |
| `env`             | `Record<string, string>` | `{}`          | Environment overrides for each Bun process.                                                                                                          |
| `updateSnapshots` | `boolean`                | `false`       | Pass `--update-snapshots` during dry runs only. Mutant runs never update snapshots. Updates stay inside the Stryker sandbox unless running in place. |

The runner controls `--reporter`, `--reporter-outfile`, `--preload`,
`--timeout`, `--bail`, `--no-orphans`, and `--test-name-pattern`. Do not
override these in `bunArgs`.

## Limits

- Tests must use `bun:test` for per-test attribution. The preload supports
  regular tests, suites, modifiers, and `test.each`/`test.for` title formatting
  supported by `node:util.format`.
- `test.concurrent` and other overlapping tests in one Bun process cannot use
  `perTest`. Use `all` or `off` for that project. The preload throws instead of
  assigning overlapping tests the same current ID.
- Full test names must be unique across files when using `perTest`. Duplicate
  IDs across different files are rejected rather than merged. Use `all` or `off`
  if titles cannot be made unique.
- `--test-name-pattern` filters test execution, not module loading. Bun still
  loads each selected test file and its imports for every mutant. There is no
  persistent process pool, watch mode, custom test command, or separate
  source-map remapping pass.
- Bun 1.4.4 does not implement every API shown on Bun's live documentation site.
  This runner uses the JUnit reporter and lifecycle hooks present in the 1.4.4
  binary.

## Development

```sh
bun install
bun run check
bun run test:mutation:fixture
bun run test:mutate
```

`check` runs strict TypeScript, ESLint, Prettier, unit tests, and integration
tests. Integration tests spawn real Stryker runs for module-load errors,
expected kills and survivors, per-test filtering, randomized execution, bail,
and timeout behavior. `test:mutation:fixture` runs the deterministic benchmark
and prints coverage-off and per-test timings.
