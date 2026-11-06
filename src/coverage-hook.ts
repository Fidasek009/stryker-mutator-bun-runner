import { writeFileSync } from 'node:fs';
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
if (!coverageDirectory) throw new Error('STRYKER_BUN_COVERAGE_DIRECTORY is required');

const runtimeMutantId = process.env.STRYKER_BUN_RUNTIME_MUTANT_ID;
if (runtimeMutantId) {
  bunTest.beforeAll(() => {
    process.env.__STRYKER_ACTIVE_MUTANT__ = runtimeMutantId;
    stryker.activeMutant = runtimeMutantId;
    const hitLimit = process.env.__STRYKER_HIT_LIMIT__;
    if (hitLimit) {
      stryker.hitLimit = Number(hitLimit);
      stryker.hitCount = 0;
    }
  });
}

if (coverageMode === 'perTest') {
  stryker.mutantCoverage ??= { static: {}, perTest: {} };
  wrapBunTest();
} else if (coverageMode === 'all') {
  stryker.mutantCoverage ??= { static: {}, perTest: {} };
}

if (coverageMode !== 'off') {
  bunTest.afterAll(() => {
    const output = stryker.mutantCoverage ?? { static: {}, perTest: {} };
    writeFileSync(
      join(coverageDirectory, `coverage-${process.pid}.json`),
      JSON.stringify(output),
      'utf8'
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
  bunTest.afterEach(() => {
    delete stryker.currentTestId;
  });
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
      return Reflect.apply(target as (...args: unknown[]) => unknown, thisArg, decorated);
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
                return typeof result === 'function'
                  ? wrapRegistration(
                      result,
                      kind,
                      suiteNames,
                      formatNames || String(property) === 'each' || String(property) === 'for'
                    )
                  : result;
              },
            })
          : wrapRegistration(value, kind, suiteNames, formatNames);
      }
      properties.set(property, wrapped);
      return wrapped;
    },
  });
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

function wrapTestCallback(callback: object, testIdTemplate: string, formatName: boolean) {
  return function (this: unknown, ...args: unknown[]) {
    const testId = formatName ? format(testIdTemplate, ...args) : testIdTemplate;
    if (stryker.currentTestId !== undefined) {
      throw new Error(
        `Concurrent tests are unsupported with coverageAnalysis=perTest (while running ${stryker.currentTestId})`
      );
    }
    stryker.currentTestId = testId;
    const coverage = (stryker.mutantCoverage ??= { static: {}, perTest: {} });
    coverage.perTest[testId] ??= {};
    return Reflect.apply(callback as (...args: unknown[]) => unknown, this, args);
  };
}
