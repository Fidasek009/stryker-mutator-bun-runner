import { TestStatus } from '@stryker-mutator/api/test-runner';
import { describe, expect, test } from 'bun:test';
import { BunResultParser } from '../../src/bun-result-parser';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="bun test" tests="4">
  <testsuite name="math.test.ts" file="math.test.ts">
    <testsuite name="outer &amp; inner">
      <testsuite name="nested">
        <testcase name="passes [case 1]" classname="nested &gt; outer &amp; inner" time="0.0125" file="math.test.ts" line="7" assertions="1" />
        <testcase name="fails" time="0.001" file="math.test.ts">
          <failure type="AssertionError" message="bad">Expected 2&#10;Received 1</failure>
        </testcase>
      </testsuite>
    </testsuite>
    <testcase name="skipped" time="0"><skipped /></testcase>
    <testcase name="(unhandled error)" time="0"><failure>module exploded</failure></testcase>
  </testsuite>
</testsuites>`;

describe('BunResultParser', () => {
  test('returns full test IDs, source locations, failures, skips, and runtime errors', () => {
    const result = new BunResultParser().parse(xml);

    expect(result.tests).toHaveLength(3);
    expect(result.tests).toContainEqual({
      id: 'outer & inner nested passes [case 1]',
      name: 'outer & inner nested passes [case 1]',
      status: TestStatus.Success,
      timeSpentMs: 13,
      fileName: 'math.test.ts',
      startPosition: { line: 7, column: 0 },
    });
    expect(result.tests).toContainEqual({
      id: 'outer & inner nested fails',
      name: 'outer & inner nested fails',
      status: TestStatus.Failed,
      failureMessage: 'Expected 2\nReceived 1',
      timeSpentMs: 1,
      fileName: 'math.test.ts',
    });
    expect(result.tests).toContainEqual({
      id: 'skipped',
      name: 'skipped',
      status: TestStatus.Skipped,
      timeSpentMs: 0,
      fileName: 'math.test.ts',
    });
    expect(result.runtimeErrors).toEqual(['module exploded']);
  });
});
