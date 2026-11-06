import { TestStatus, type TestResult } from '@stryker-mutator/api/test-runner';
import { XMLParser } from 'fast-xml-parser';

interface XmlText {
  '#text'?: string;
  message?: string;
  type?: string;
}

interface XmlTestCase {
  name?: string;
  time?: string;
  file?: string;
  line?: string;
  failure?: Array<string | XmlText>;
  skipped?: unknown[];
}

interface XmlSuite {
  name?: string;
  file?: string;
  testsuite?: XmlSuite[];
  testcase?: XmlTestCase[];
}

interface XmlDocument {
  testsuites?: {
    testsuite?: XmlSuite[];
  };
}

export interface ParsedBunResults {
  tests: TestResult[];
  runtimeErrors: string[];
}

const runtimeTestNames = new Set([
  '(unhandled error)',
  '(worker crashed)',
  '(aborted)',
  '(interrupted)',
]);

export class BunResultParser {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: false,
    htmlEntities: true,
    isArray: name => ['testsuite', 'testcase', 'failure', 'skipped'].includes(name),
  });

  public parse(xml: string): ParsedBunResults {
    const document = this.parser.parse(xml) as XmlDocument;
    const tests: TestResult[] = [];
    const runtimeErrors: string[] = [];
    for (const fileSuite of document.testsuites?.testsuite ?? []) {
      this.parseSuite(fileSuite, [], fileSuite.file, tests, runtimeErrors);
    }
    return { tests, runtimeErrors };
  }

  private parseSuite(
    suite: XmlSuite,
    suiteNames: string[],
    fileName: string | undefined,
    tests: TestResult[],
    runtimeErrors: string[]
  ): void {
    for (const testCase of suite.testcase ?? []) {
      this.addTestResult(testCase, suiteNames, fileName, tests, runtimeErrors);
    }
    for (const childSuite of suite.testsuite ?? []) {
      this.parseSuite(
        childSuite,
        [...suiteNames, childSuite.name ?? '(unnamed suite)'],
        childSuite.file ?? fileName,
        tests,
        runtimeErrors
      );
    }
  }

  private addTestResult(
    testCase: XmlTestCase,
    suiteNames: string[],
    suiteFileName: string | undefined,
    tests: TestResult[],
    runtimeErrors: string[]
  ): void {
    const name = [...suiteNames, testCase.name ?? '(unnamed test)'].join(' ');
    const failureMessage = testCase.failure?.[0] ? textContent(testCase.failure[0]) : undefined;
    if (testCase.name && runtimeTestNames.has(testCase.name)) {
      runtimeErrors.push(failureMessage ?? `Bun reported ${testCase.name}`);
      return;
    }
    const fileName = testCase.file ?? suiteFileName;
    const base = {
      id: name,
      name,
      timeSpentMs: Math.round(Number(testCase.time ?? '0') * 1000),
      ...(fileName ? { fileName } : {}),
      ...(testCase.line ? { startPosition: { line: Number(testCase.line), column: 0 } } : {}),
    };
    if (testCase.failure) {
      tests.push({
        ...base,
        status: TestStatus.Failed,
        failureMessage: failureMessage ?? 'Test failed',
      });
    } else if (testCase.skipped) {
      tests.push({ ...base, status: TestStatus.Skipped });
    } else {
      tests.push({ ...base, status: TestStatus.Success });
    }
  }
}

function textContent(value: string | XmlText): string {
  if (typeof value === 'string') return value.trim();
  return (value['#text'] ?? value.message ?? value.type ?? 'Test failed').trim();
}
