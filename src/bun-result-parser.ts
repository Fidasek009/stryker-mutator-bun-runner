import { TestStatus, type TestResult } from '@stryker-mutator/api/test-runner';
import { XML } from 'bun';

type XmlInput = string | Uint8Array;
type XmlNode = XML.Node;
type XmlChild = XmlNode['children'][number];

export type ParsedBunResults = {
  tests: TestResult[];
  runtimeErrors: string[];
};

const runtimeTestNames = new Set([
  '(unhandled error)',
  '(worker crashed)',
  '(aborted)',
  '(interrupted)',
]);

export class BunResultParser {
  public parse(xml: XmlInput): ParsedBunResults {
    const document = XML.parse(xml, { compact: false });
    const tests: TestResult[] = [];
    const runtimeErrors: string[] = [];
    if (document.name === 'testsuites') {
      for (const fileSuite of document.children) {
        if (isNamedElement(fileSuite, 'testsuite')) {
          this.parseSuite(fileSuite, [], fileSuite.attributes.file, tests, runtimeErrors);
        }
      }
    }
    return { tests, runtimeErrors };
  }

  private parseSuite(
    suite: XmlNode,
    suiteNames: string[],
    fileName: string | undefined,
    tests: TestResult[],
    runtimeErrors: string[]
  ): void {
    for (const child of suite.children) {
      if (isNamedElement(child, 'testcase')) {
        this.addTestResult(child, suiteNames, fileName, tests, runtimeErrors);
      }
    }
    for (const child of suite.children) {
      if (isNamedElement(child, 'testsuite')) {
        this.parseSuite(
          child,
          [...suiteNames, child.attributes.name ?? '(unnamed suite)'],
          child.attributes.file ?? fileName,
          tests,
          runtimeErrors
        );
      }
    }
  }

  private addTestResult(
    testCase: XmlNode,
    suiteNames: string[],
    suiteFileName: string | undefined,
    tests: TestResult[],
    runtimeErrors: string[]
  ): void {
    const testName = testCase.attributes.name;
    const name = [...suiteNames, testName ?? '(unnamed test)'].join(' ');
    const failure = findChild(testCase, 'failure');
    const failureMessage = failure ? textContent(failure) : undefined;
    if (testName && runtimeTestNames.has(testName)) {
      runtimeErrors.push(failureMessage ?? `Bun reported ${testName}`);
      return;
    }
    const fileName = testCase.attributes.file ?? suiteFileName;
    const line = testCase.attributes.line;
    const base = {
      id: name,
      name,
      timeSpentMs: Math.round(Number(testCase.attributes.time ?? '0') * 1000),
      ...(fileName ? { fileName } : {}),
      ...(line ? { startPosition: { line: Number(line) - 1, column: 0 } } : {}),
    };
    if (failure) {
      tests.push({
        ...base,
        status: TestStatus.Failed,
        failureMessage: failureMessage ?? 'Test failed',
      });
    } else if (findChild(testCase, 'skipped')) {
      tests.push({ ...base, status: TestStatus.Skipped });
    } else {
      tests.push({ ...base, status: TestStatus.Success });
    }
  }
}

function isNamedElement(child: XmlChild, name: string): child is XmlNode {
  return typeof child === 'object' && 'name' in child && child.name === name;
}

function findChild(parent: XmlNode, name: string): XmlNode | undefined {
  return parent.children.find((child): child is XmlNode => isNamedElement(child, name));
}

function textContent(element: XmlNode): string | undefined {
  const text = element.children.filter(child => typeof child === 'string').join('');
  return (text || element.attributes.message || element.attributes.type)?.trim();
}
