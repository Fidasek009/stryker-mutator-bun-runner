# Benchmarks

## Bun runner versus Vitest runner

Run the comparison with:

```sh
bun install
bun run benchmark:runners
```

The command builds the plugin, performs one warmup per runner, then alternates Bun and Vitest order across ten measured runs. Raw samples and runtime details are written to `tests/fixtures/runner-comparison/reports/comparison.json`.

### Method

- Full `stryker run` wall time, including startup, instrumentation, sandboxing, the dry run, every mutant run, and JSON reporting. Installation and the build happen before timing.
- The same TypeScript source, six mutations, ten authored tests, per-test coverage, concurrency 2, and disabled bail.
- Equivalent test bodies using `bun:test` with this runner under Bun and `vitest` with the official Vitest runner under Node.
- Every run must produce the same normalized test names and mutant outcomes. A mismatch stops the benchmark.
- Caches remain enabled. One warmup per runner runs before measurement. Results are not cold-start measurements.

The fixture is intentionally small. It measures fixed runner overhead alongside test execution; results will differ for larger or computation-heavy suites.

### Reference result

Measured on Linux x64 with an 8-core AMD EPYC processor. Values are medians of ten interleaved runs.

| Stryker setup        | Median | Range          | Relative     |
| -------------------- | -----: | -------------- | ------------ |
| Bun + this runner    | 3.11 s | 2.88 to 3.44 s | 1.91× faster |
| Node + Vitest runner | 5.93 s | 5.68 to 7.09 s | 1×           |

Exact runtime versions and all samples are recorded in the generated JSON report.
