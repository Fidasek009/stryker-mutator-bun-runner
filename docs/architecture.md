# Architecture

## Scope

The package is a Stryker `TestRunner` plugin for `bun:test`. It is not a Stryker
distribution or a Node-to-Bun adapter. Stryker workers run under Bun, and every
dry or mutant run starts a separate Bun process.

The runtime requirements live in `package.json`. This document describes
behavior, not versions or performance guarantees.

## Modules

| File                             | Responsibility                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                   | Register the `bun` plugin and declare its JSON configuration schema.                                                               |
| `src/bun-test-runner.ts`         | Implement Stryker's dry-run and mutant-run contracts, separate file selections from name selections, and map outcomes.             |
| `src/bun-test-adapter.ts`        | Resolve test files, spawn children, inject the preload, enforce overall timeouts, collect coverage, and clean temporary files.     |
| `src/coverage-hook.ts`           | Run before test modules, wrap test registration and lifecycle hooks, select tests, activate mutants, and serialize child coverage. |
| `src/bun-result-parser.ts`       | Convert Bun JUnit XML into Stryker test results and distinguish runtime errors from failed assertions.                             |
| `src/bun-test-runner-options.ts` | Define plugin configuration and adapter run contracts.                                                                             |

The build emits ESM JavaScript and declarations from `tsconfig.build.json` into
`dist/`. No dual CJS build is produced.

## Execution flow

1. Stryker invokes `dryRun` or `mutantRun` on the class plugin registered in
   `src/index.ts`.
2. The runner creates adapter options. It retains absolute file paths discovered
   during the dry run so later Stryker file filters do not become test-name
   regular expressions.
3. The adapter expands test-file globs and excludes dependency tests under
   `node_modules`. Exact paths are made absolute because Bun treats relative
   positional arguments as substring matches.
4. The adapter creates a temporary directory under the sandbox, builds a JUnit
   command, and starts a new child with `Bun.spawn`.
5. The preload activates static mutants from the environment before imports or
   activates runtime mutants in `beforeAll` after imports. Hit limits are
   initialized before instrumented code executes.
6. The child writes JUnit results and coverage when applicable. The adapter
   parses output and deletes the temporary directory in `finally`.
7. The runner maps failures to `Killed`, passing runs to `Survived`, subprocess
   timeouts and hit-limit exhaustion to `Timeout`, and import or empty-process
   failures to `Error`.

The adapter tracks abort controllers for active children so `dispose` can
terminate them. Processes are not reused across runs.

## Coverage and test identity

A `perTest` dry run wraps the `bun:test` exports before test modules load.
Registration wrappers retain full suite names and set
`__stryker__.currentTestId` for Stryker's instrumenter. Lifecycle coverage uses
a pending per-test bucket that is transferred to the test when its callback
begins.

Before `.each` rows are registered, the preload expands placeholders into
distinct titles. Both test selection and coverage use the same expanded title,
avoiding Bun's differing JUnit and native filtering behavior.

Test-name selection happens during registration. Matching registrations run
normally; nonmatching registrations become skipped tests. Every selected file
still loads, so top-level module failures remain visible. Duplicate titles and
overlapping tests are rejected because one global test ID cannot safely
attribute them.

With coverage analysis `all`, static coverage is returned without per-test
attribution. With `off`, no coverage artifact is collected.

## Failure semantics

- Normal assertion failures produce `Killed`, including the IDs of killing
  tests.
- Import crashes and nonzero runs without failed tests produce `Error` rather
  than survival.
- An empty `testFilter` means Stryker found no covering tests and does not start
  Bun.
- Any completed mutant run with no executed tests produces `Error`. Unmatched
  names cannot masquerade as surviving mutants.
- Bun JUnit line numbers are converted from 1-based values to Stryker's 0-based
  positions.
- Snapshot updates are allowed during dry runs only.

## Development

The test layout is:

- Unit tests for JUnit parsing, filter regular-expression escaping, and package
  identity.
- Lifecycle subprocess fixtures for kill/survive/error outcomes, `beforeEach`,
  parameterized tests, file filters, bail, cleanup, duplicate titles, and
  dependency exclusion.
- Real Stryker fixture runs for module-load failures and expected killed,
  survived, and no-coverage outcomes.

`bun run check` runs strict types, lint, formatting, all tests, and a TypeScript
build. `stryker.config.json` selectively self-mutates the result parser with its
unit test. It is not a whole-plugin mutation-coverage claim.

Source and issue links point to `Fidasek009/stryker-mutator-bun-runner`.
