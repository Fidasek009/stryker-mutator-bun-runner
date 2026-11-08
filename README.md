# ⚡ Stryker Bun Runner

Mutation testing should be fast. Run StrykerJS entirely on Bun, execute only the tests that can catch each mutant, and get back to work sooner.

Built for `bun:test`, with TypeScript and JSX support out of the box.

## Why you'll like it

- ⚡ **No Node.js detour.** Bun runs Stryker and every test process.
- 🎯 **Only the tests that matter.** Per-test coverage finds the tests that can catch each mutant. Bail stops the run at the first failure.
- 🚀 **Fast at every step.** Native Bun APIs keep startup, file discovery, and result parsing lean. No unnecessary preloads.
- 🧼 **A clean slate every time.** Fresh processes prevent cached state and active mutants from leaking between runs.
- 🧰 **Your tests, your setup.** Use TypeScript, JSX, snapshots, custom Bun flags, and environment overrides.

## Real runs. Real speed.

**1.9× faster than the Vitest runner on the full mutation suite.** Not a micro-benchmark: every number includes Stryker startup, instrumentation, the dry run, all mutant runs, and reporting.

| Stryker setup         | Median wall time |
| --------------------- | ---------------: |
| **Bun + this runner** |       **3.11 s** |
| Node + Vitest runner  |           5.93 s |

Six mutants. Ten equivalent tests. Ten interleaved runs. The full setup and a benchmark you can run yourself are in [Benchmarks](docs/benchmarks.md).

## Install

```sh
bun add --dev @stryker-mutator/core @fidasek009/stryker-mutator-bun-runner
```

## Get running

Create `stryker.config.json`:

```json
{
  "testRunner": "bun",
  "plugins": ["@fidasek009/stryker-mutator-bun-runner"],
  "mutate": ["src/**/*.ts", "!src/**/*.test.ts"],
  "coverageAnalysis": "perTest",
  "concurrency": 2,
  "bun": {
    "testFiles": ["test/**/*.test.ts"],
    "timeout": 5000
  }
}
```

Run Stryker with Bun too:

```sh
bun ./node_modules/@stryker-mutator/core/bin/stryker.js run
```

That's it. Less waiting, more mutant hunting.

## Tune it

| Option            | Type                     | Default       | What it does                                      |
| ----------------- | ------------------------ | ------------- | ------------------------------------------------- |
| `testFiles`       | `string[]`               | Bun discovery | Select test files with paths or globs.            |
| `timeout`         | `number`                 | `5000`        | Set each test's timeout in milliseconds.          |
| `bail`            | `boolean`                | `false`       | Stop the dry run after its first failure.         |
| `bunArgs`         | `string[]`               | `[]`          | Add flags such as `["--randomize", "--seed=42"]`. |
| `env`             | `Record<string, string>` | `{}`          | Set environment variables for test processes.     |
| `updateSnapshots` | `boolean`                | `false`       | Update snapshots during dry runs only.            |

Reporter, preload, timeout, bail, and orphan-handling flags belong to the runner. Leave them out of `bunArgs`.

## Spend less time testing mutants

Use `coverageAnalysis: "perTest"` to let Stryker learn which tests cover each mutant, then run only those tests. Use `"all"` for static coverage without test attribution, or `"off"` to run everything.

For `perTest`, use unique expanded test titles and avoid overlapping tests such as `test.concurrent`. Choose `"all"` or `"off"` for those suites. Test filtering skips execution, but selected files and their imports still load.

---

Questions, bugs, and ideas are welcome on [GitHub](https://github.com/Fidasek009/stryker-mutator-bun-runner/issues).
