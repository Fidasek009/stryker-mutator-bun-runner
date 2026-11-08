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

Measured on Linux x64 with an 8-core AMD EPYC processor. Exact runtime versions and every sample are recorded in the generated JSON report.

| Stryker setup                            |  Median | Range            | Relative     |
| ---------------------------------------- | ------: | ---------------- | ------------ |
| Bun + this runner                        | 22.64 s | 20.84 to 24.43 s | 3.34× faster |
| Node + command runner running `bun test` | 75.66 s | 70.59 to 80.23 s | 1×           |

Thirty-minute benchmarking cap. All ten measured runs per runner completed with deterministic outcomes.
