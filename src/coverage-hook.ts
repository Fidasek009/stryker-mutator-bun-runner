import { join } from 'node:path';
import { format } from 'node:util';
import type { MutantCoverage } from '@stryker-mutator/api/core';
import * as bunTest from 'bun:test';

interface StrykerState {
  activeMutant?: string;
  currentTestId?: string;
  hitCount?: number;
  hitLimit?: number;
  mutantCoverage?: MutantCoverage;
}

interface StrykerGlobal {
  __stryker__?: StrykerState;
}

const runtimeGlobal = globalThis as typeof globalThis & StrykerGlobal;
const stryker = (runtimeGlobal.__stryker__ ??= {});
const coverageDirectory = process.env.STRYKER_BUN_COVERAGE_DIRECTORY;
const coverageMode = process.env.STRYKER_BUN_COVERAGE_MODE;
const configuredTestNamePattern = process.env.STRYKER_BUN_TEST_NAME_PATTERN;
const testNamePattern = configuredTestNamePattern
  ? new RegExp(configuredTestNamePattern)
  : undefined;
const beforeEachTestId = '__stryker_beforeEach__';
let executingTestId: string | undefined;
if (!coverageDirectory) throw new Error('STRYKER_BUN_COVERAGE_DIRECTORY is required');

const hitLimit = process.env.__STRYKER_HIT_LIMIT__;
if (hitLimit) {
  stryker.hitLimit = Number(hitLimit);
  stryker.hitCount = 0;
}
const runtimeMutantId = process.env.STRYKER_BUN_RUNTIME_MUTANT_ID;
if (runtimeMutantId) {
  bunTest.beforeAll(() => {
    process.env.__STRYKER_ACTIVE_MUTANT__ = runtimeMutantId;
    stryker.activeMutant = runtimeMutantId;
  });
}

if (coverageMode !== undefined && coverageMode !== 'off') {
  stryker.mutantCoverage ??= { static: {}, perTest: {} };
}
if (coverageMode === 'perTest' || testNamePattern !== undefined) {
  wrapBunTest();
}

if (coverageMode !== 'off') {
  bunTest.afterAll(async () => {
    const output = stryker.mutantCoverage ?? { static: {}, perTest: {} };
    await Bun.write(
      join(coverageDirectory, `coverage-${process.pid}.json`),
      JSON.stringify(output)
    );
    delete stryker.currentTestId;
  });
}

function wrapBunTest(): void {
  const suiteNames: string[] = [];
  const test = wrapRegistration(bunTest.test, 'test', suiteNames, false);
  const describe = wrapRegistration(bunTest.describe, 'describe', suiteNames, false);
  bunTest.mock.module('bun:test', () => ({
    ...bunTest,
    test,
    it: test,
    describe,
  }));
  if (coverageMode === 'perTest') {
    // Bun does not expose the test name to beforeEach hooks.
    bunTest.beforeEach(() => {
      stryker.currentTestId = beforeEachTestId;
      const coverage = (stryker.mutantCoverage ??= { static: {}, perTest: {} });
      coverage.perTest[beforeEachTestId] = {};
    });
    bunTest.afterEach(() => {
      delete stryker.currentTestId;
      executingTestId = undefined;
      if (stryker.mutantCoverage) delete stryker.mutantCoverage.perTest[beforeEachTestId];
    });
  }
}

function wrapRegistration<T extends object>(
  original: T,
  kind: 'test' | 'describe',
  suiteNames: string[],
  formatNames: boolean
): T {
  const factories = new Set(['each', 'for', 'if', 'runIf', 'skipIf', 'todoIf', 'extend']);
  const lifecycleHooks = new Set(['beforeAll', 'beforeEach', 'afterAll', 'afterEach']);
  const properties = new Map<PropertyKey, unknown>();
  return new Proxy(original, {
    apply(target, thisArg, args) {
      if (kind === 'describe') {
        return registerDescribe(target, thisArg, args, suiteNames);
      }
      const testId = [...suiteNames, String(args[0])].join(' ');
      const decorated = args.map((argument, index) =>
        index > 0 && typeof argument === 'function'
          ? wrapTestCallback(argument, testId, formatNames)
          : argument
      );
      return registerTest(target, thisArg, decorated, testId);
    },
    get(target, property) {
      if (properties.has(property)) return properties.get(property);
      const value = Reflect.get(target, property, target) as unknown;
      let wrapped = value;
      if (typeof value === 'function' && !lifecycleHooks.has(String(property))) {
        wrapped = factories.has(String(property))
          ? new Proxy(value, {
              apply(innerTarget, thisArg, args) {
                const result = Reflect.apply(innerTarget, target, args);
                if (typeof result !== 'function') return result;
                if (String(property) === 'each') {
                  return wrapEachFactory(result, original, kind, suiteNames, args[0]);
                }
                return wrapRegistration(
                  result,
                  kind,
                  suiteNames,
                  formatNames || String(property) === 'for'
                );
              },
            })
          : wrapRegistration(value, kind, suiteNames, formatNames);
      }
      properties.set(property, wrapped);
      return wrapped;
    },
  });
}

function wrapEachFactory(
  factory: object,
  original: object,
  kind: 'test' | 'describe',
  suiteNames: string[],
  table: unknown
): object {
  if (!Array.isArray(table)) throw new Error('test.each requires an array of test cases');
  return new Proxy(factory, {
    apply(target, thisArg, args) {
      const callbackIndex = args.findIndex(
        (argument, index) => index > 0 && typeof argument === 'function'
      );
      if (callbackIndex < 0)
        return Reflect.apply(target as (...a: unknown[]) => unknown, thisArg, args);
      const callback = args[callbackIndex];
      return table.map((row, index) => {
        const title = formatEachTitle(String(args[0]), row, index);
        const testId = [...suiteNames, title].join(' ');
        const wrappedCallback = wrapTestCallback(function (this: unknown, ...callArgs: unknown[]) {
          return Reflect.apply(callback as (...a: unknown[]) => unknown, this, [
            ...rowArguments(row),
            ...callArgs,
          ]);
        }, testId);
        const registrationArgs = [title, ...args.slice(1)];
        registrationArgs[callbackIndex] = wrappedCallback;
        return registerTest(original, original, registrationArgs, testId);
      });
    },
  });
}

function registerTest(target: object, thisArg: unknown, args: unknown[], testId: string): unknown {
  const registration =
    testNamePattern?.test(testId) === false ? Reflect.get(target, 'skip', target) : target;
  return Reflect.apply(registration as (...args: unknown[]) => unknown, thisArg, args);
}

function rowArguments(row: unknown): unknown[] {
  return Array.isArray(row) ? row : [row];
}

function formatEachTitle(template: string, row: unknown, index: number): string {
  const title = template
    .replaceAll('%#', String(index))
    .replaceAll('%p', '%s')
    .replace(/\$([$A-Z_a-z][\w$]*(?:\.[$A-Z_a-z][\w$]*)*)/g, (expression, path: string) => {
      const value = path.split('.').reduce<unknown>((current, key) => {
        if (typeof current !== 'object' || current === null) return;
        return (current as Record<string, unknown>)[key];
      }, row);
      return value === undefined ? expression : String(value);
    });
  return format(title, ...rowArguments(row));
}

function registerDescribe(
  target: object,
  thisArg: unknown,
  args: unknown[],
  suiteNames: string[]
): unknown {
  const inheritedSuites = suiteNames.slice();
  const decorated = args.map((argument, index) => {
    if (index === 0 || typeof argument !== 'function') return argument;
    return function (this: unknown, ...callbackArgs: unknown[]) {
      const previousSuites = suiteNames.slice();
      suiteNames.splice(0, suiteNames.length, ...inheritedSuites, String(args[0]));
      try {
        return Reflect.apply(argument, this, callbackArgs);
      } finally {
        suiteNames.splice(0, suiteNames.length, ...previousSuites);
      }
    };
  });
  return Reflect.apply(target as (...args: unknown[]) => unknown, thisArg, decorated);
}

function wrapTestCallback(callback: object, testIdTemplate: string, formatName = false) {
  return function (this: unknown, ...args: unknown[]) {
    if (coverageMode !== 'perTest') {
      return Reflect.apply(callback as (...args: unknown[]) => unknown, this, args);
    }
    const testId = formatName ? format(testIdTemplate, ...args) : testIdTemplate;
    if (executingTestId !== undefined) {
      throw new Error(
        `Concurrent tests are unsupported with coverageAnalysis=perTest (while running ${executingTestId})`
      );
    }
    executingTestId = testId;
    stryker.currentTestId = testId;
    const coverage = (stryker.mutantCoverage ??= { static: {}, perTest: {} });
    const testCoverage = (coverage.perTest[testId] ??= {});
    for (const [mutantId, hits] of Object.entries(coverage.perTest[beforeEachTestId] ?? {})) {
      testCoverage[mutantId] = (testCoverage[mutantId] ?? 0) + hits;
    }
    delete coverage.perTest[beforeEachTestId];
    return Reflect.apply(callback as (...args: unknown[]) => unknown, this, args);
  };
}
