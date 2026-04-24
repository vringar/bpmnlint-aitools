const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const rule = require('../rules/from-ai-tool-call')();

function makeNode(inputSources) {
  const inputParameters = inputSources.map((source) => ({ source }));
  return {
    id: 'Task_1',
    $type: 'bpmn:ServiceTask',
    extensionElements: {
      values: [
        {
          $type: 'zeebe:IoMapping',
          inputParameters,
          outputParameters: [],
        },
      ],
    },
  };
}

function collectReports(node) {
  const reports = [];
  rule.check(node, {
    report: (id, message) => reports.push({ id, message }),
  });
  return reports;
}

describe('from-ai-tool-call', () => {
  it('passes when first arg is toolCall.<param>', () => {
    const node = makeNode(['= fromAi(toolCall.url, "The URL to fetch")']);
    assert.deepEqual(collectReports(node), []);
  });

  it('passes for multiple valid fromAi calls in one expression', () => {
    const node = makeNode([
      '= { url: fromAi(toolCall.url, "url"), count: fromAi(toolCall.count, "count", "number") }',
    ]);
    assert.deepEqual(collectReports(node), []);
  });

  it('passes when expression has no fromAi call', () => {
    const node = makeNode(['= someVariable']);
    assert.deepEqual(collectReports(node), []);
  });

  it('reports when first arg is a plain variable (not toolCall.*)', () => {
    const node = makeNode(['= fromAi(someOtherVar, "desc")']);
    const reports = collectReports(node);
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /someOtherVar/);
  });

  it('reports when first arg is bare "toolCall" without property access', () => {
    const node = makeNode(['= fromAi(toolCall, "desc")']);
    const reports = collectReports(node);
    assert.equal(reports.length, 1);
  });

  it('reports when first arg is a string literal', () => {
    const node = makeNode(['= fromAi("hardcoded", "desc")']);
    const reports = collectReports(node);
    assert.equal(reports.length, 1);
  });

  it('reports each invalid call separately in a multi-call expression', () => {
    const node = makeNode([
      '= { a: fromAi(toolCall.a, "ok"), b: fromAi(badVar, "not ok") }',
    ]);
    const reports = collectReports(node);
    assert.equal(reports.length, 1);
    assert.match(reports[0].message, /badVar/);
  });

  it('handles node without extensionElements gracefully', () => {
    const node = { id: 'Task_1', $type: 'bpmn:ServiceTask' };
    assert.doesNotThrow(() => collectReports(node));
    assert.deepEqual(collectReports(node), []);
  });

  it('handles expression without leading = sign', () => {
    const node = makeNode(['fromAi(toolCall.x, "desc")']);
    assert.deepEqual(collectReports(node), []);
  });
});
