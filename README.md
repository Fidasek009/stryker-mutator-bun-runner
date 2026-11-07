# @fidasek009/stryker-mutator-bun-runner

A Stryker test-runner plugin for `bun:test`. Stryker itself must run under Bun, not Node.js. The runner uses the same runtime for the Stryker worker and each subprocess that executes tests.

## Install

```sh
bun add --dev @stryker-mutator/core @fidasek009/stryker-mutator-bun-runner
```

Supported Bun and Stryker core versions are declared in `package.json` under `engines` and `peerDependencies`.

## Configure

Set `testRunner` to `bun` and load this package in `strykerPlugins`. `$schema` is optional.

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "bun",
  "plugins": ["@fidasek009/stryker-mutator-bun-runner"],
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

Leave Stryker's `packageManager` unset when dependencies already exist. Its schema supports `npm`, `yarn`, and `pnpm`, not Bun.

## Run

```sh
bun ./node_modules/@stryker-mutator/core/bin/stryker.js run
```

Do not launch Stryker with `npx` or Node. The plugin uses `Bun.spawn`, so those launch methods are unsupported.

## Options

Options belong under the `bun` key.

| Option            | Type                     | Default       | Description                                                                                                             |
| ----------------- | ------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `testFiles`       | `string[]`               | Bun discovery | Paths or glob patterns. Globs must match at least one project file. Dependency tests under `node_modules` are excluded. |
| `timeout`         | `number`                 | `5000`        | Per-test timeout passed to `bun test`, in milliseconds.                                                                 |
| `bail`            | `boolean`                | `false`       | Stop the dry run after its first failure. Mutant runs bail unless Stryker sets `disableBail`.                           |
| `bunArgs`         | `string[]`               | `[]`          | Extra `bun test` flags, such as `["--randomize", "--seed=42"]`.                                                         |
| `env`             | `Record<string, string>` | `{}`          | Environment overrides for every Bun process.                                                                            |
| `updateSnapshots` | `boolean`                | `false`       | Pass `--update-snapshots` during dry runs only. Mutant runs never update snapshots.                                     |

The runner supplies `--reporter`, `--reporter-outfile`, `--preload`, `--timeout`, `--bail`, and `--no-orphans`. Do not override these in `bunArgs`. Test-name filtering is performed by the preload rather than Bun's own `--test-name-pattern`.

## Behavior

- Every dry or mutant run starts a fresh Bun process. Module caches, globals, snapshots, environment changes, and active mutants cannot leak between runs.
- Bun's JUnit reporter supplies results, failures, skips, durations, file names, and zero-based source positions.
- A failed test kills its mutant. Passing tests allow a covered mutant to survive.
- Import crashes and non-coverage runs with zero executed tests return an error instead of `Survived`.
- A failed run that reaches Stryker's hit limit returns `Timeout`, not `Killed`.
- Each run has an overall abort timeout and `--no-orphans`. Disposal aborts children owned by that runner.
- Stryker may still schedule independent runners concurrently according to `concurrency`.

### Per-test coverage

With `coverageAnalysis: "perTest"`, the child preload wraps `bun:test` registration and sets `__stryker__.currentTestId` during execution. Coverage performed by file-level and suite-level `beforeEach` hooks is assigned to the corresponding test.

Stryker uses the dry run's coverage to select subsequent mutant runs. File paths supplied by Stryker are passed as file selections. Test IDs are matched by the preload; unmatched registrations become skipped tests. `test.each` titles are expanded before registration so JUnit names, coverage IDs, and selected tests agree.

`coverageAnalysis: "all"` collects static coverage without test attribution. `"off"` skips coverage collection.

### Mutant activation

Static mutants use `__STRYKER_ACTIVE_MUTANT__` from process startup, so they are active during imports. Runtime mutants activate in a preload `beforeAll` hook after test modules are imported. Each Stryker worker and test run receives a new environment.

## Limitations

- The host workflow is Bun-only. There is no supported Node-hosted Stryker path.
- Overlapping tests such as `test.concurrent` cannot use `perTest`; the preload fails them instead of assigning overlapping coverage to one test. Use `all` or `off`.
- Full expanded test titles must be unique across a dry run. Duplicate titles are rejected whether they occur in one file or several files.
- Test filtering does not avoid loading selected test files or their imports. It only controls test registration and execution.
- Tests must use `bun:test`. No process pool, watch mode, custom test command, or separate source-map remapping is provided.
- `test.concurrent`, unrelated default test runners, and custom lifecycle frameworks are not made compatible by the preload.

## Development

```sh
bun install
bun run check
bun run test:mutation:fixture
bun run test:mutate
```

`bun run check` runs strict TypeScript, zero-warning ESLint, Prettier, unit tests, and integration tests. Integration fixtures exercise real Stryker runs for module-load errors, kills and survivors, static and runtime activation, parameterized tests, path and name filters, lifecycle hooks, random order, bail, timeout, and cleanup.

`test:mutation:fixture` prints coverage-off and per-test wall times for a small deterministic fixture. It is not a guarantee of times for other projects. `test:mutate` mutates the result parser through the plugin; it is not a claim about coverage for the rest of the source files.

Report bugs and request features at [the project issue tracker](https://github.com/Fidasek009/stryker-mutator-bun-runner/issues).
