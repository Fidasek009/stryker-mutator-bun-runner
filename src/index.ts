import { declareClassPlugin, PluginKind } from '@stryker-mutator/api/plugin';
import { BunTestRunner } from './bun-test-runner.js';

export const strykerPlugins = [declareClassPlugin(PluginKind.TestRunner, 'bun', BunTestRunner)];

export const strykerValidationSchema = {
  properties: {
    bun: {
      type: 'object',
      properties: {
        testFiles: { type: 'array', items: { type: 'string' } },
        timeout: { type: 'number', exclusiveMinimum: 0 },
        bail: { type: 'boolean' },
        bunArgs: { type: 'array', items: { type: 'string' } },
        env: { type: 'object', additionalProperties: { type: 'string' } },
        updateSnapshots: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
};

export { BunTestRunner } from './bun-test-runner.js';
export { BunTestAdapter } from './bun-test-adapter.js';
export { BunResultParser } from './bun-result-parser.js';
export type { BunTestRunnerOptions, StrykerBunOptions } from './bun-test-runner-options.js';
