# Benchmarks

## This runner versus Stryker's command runner

Run the comparison with:

```sh
bun install
bun run benchmark:runners
```

The command builds the plugin, performs one warmup per runner, then alternates execution order across ten measured runs. Raw samples and runtime details are written to `tests/fixtures/runner-comparison/reports/comparison.json`.

### Method

- Measure full `stryker run` wall time, including startup, instrumentation, sandboxing, the dry run, every mutant run, and JSON reporting. Installation and the build happen before timing.
- Compare Bun-hosted Stryker using this runner with Node-hosted Stryker using its built-in command runner to invoke `bun test`. Both stacks execute the same `bun:test` files.
- Use the same TypeScript sources, authored tests, concurrency 2, disabled bail, and per-test coverage setting. Stryker ignores coverage for the command runner, so it runs every test for every mutant.
- The suite contains 75 mutants and 1,050 tests across arithmetic and statistics code. Statistical tests process arrays of 8,192 values. There are no sleeps or artificial delays.
- Require deterministic test and mutant outcomes per runner, identical mutant IDs across runners, and no runtime-error results. The command runner's synthetic single-test result and its `Survived` outcomes for uncovered mutants are expected consequences of missing coverage data.
- Keep caches enabled and warm up each runner once. Dependency installation is excluded. These are not cold-start measurements.

The fixture is a parameterized numerical workload. Per-test selection has more impact when tests cover distinct code paths and execute real work. Results will differ for other suites, especially CPU-light tests where coverage collection costs more than execution.

### Reference result

[The README](../README.md#real-runs-real-speed) contains the published reference timings from a Linux x64 run. The generated JSON report records exact runtime versions and every sample.
