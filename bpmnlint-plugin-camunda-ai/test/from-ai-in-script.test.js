const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const rule = require('../rules/from-ai-in-script')();

function makeScriptTask(id, { scriptExpression = null, inputSources = [] } = {}) {
  const values = [];

  if (scriptExpression !== null) {
    values.push({ $type: 'zeebe:Script', expression: scriptExpression });
  }

  if (inputSources.length > 0) {
    values.push({
      $type: 'zeebe:IoMapping',
      inputParameters: inputSources.map((source) => ({ source })),
      outputParameters: [],
    });
  }

  return {
    id,
    $type: 'bpmn:ScriptTask',
    extensionElements: values.length ? { values } : undefined,
  };
}

function makeAdHocSubProcess(flowElements) {
  return {
    id: 'AdHocSubProcess_1',
    $type: 'bpmn:AdHocSubProcess',
    flowElements,
  };
}

function collectReports(node) {
  const reports = [];
  rule.check(node, {
    report: (id, message) => reports.push({ id, message }),
  });
  return reports;
}

describe('from-ai-in-script', () => {
  it('passes when fromAi() is in a zeebe:input mapping and script uses variable', () => {
    const node = makeAdHocSubProcess([
      makeScriptTask('Task_1', {
        scriptExpression: '= clusterId',
        inputSources: ['= fromAi(toolCall.clusterId, "The cluster UUID", "string")'],
      }),
    ]);
    assert.deepEqual(collectReports(node), []);
  });

  it('reports when fromAi() is in script expression and no zeebe:input mapping has fromAi()', () => {
    const node = makeAdHocSubProcess([
      makeScriptTask('Task_1', {
        scriptExpression: '= fromAi(toolCall.clusterId, "The cluster UUID", "string")',
      }),
    ]);
    const reports = collectReports(node);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Task_1');
    assert.match(reports[0].message, /fromAi\(\) in script expression/);
    assert.match(reports[0].message, /zeebe:input mapping/);
  });

  it('passes when fromAi() is in both script and a zeebe:input source', () => {
    const node = makeAdHocSubProcess([
      makeScriptTask('Task_1', {
        scriptExpression: '= fromAi(toolCall.x, "desc")',
        inputSources: ['= fromAi(toolCall.x, "desc")'],
      }),
    ]);
    assert.deepEqual(collectReports(node), []);
  });

  it('passes when script expression has no fromAi()', () => {
    const node = makeAdHocSubProcess([
      makeScriptTask('Task_1', {
        scriptExpression: '= someVariable',
        inputSources: [],
      }),
    ]);
    assert.deepEqual(collectReports(node), []);
  });

  it('passes when ScriptTask has no extensionElements', () => {
    const node = makeAdHocSubProcess([
      { id: 'Task_1', $type: 'bpmn:ScriptTask' },
    ]);
    assert.doesNotThrow(() => collectReports(node));
    assert.deepEqual(collectReports(node), []);
  });

  it('does not report non-ScriptTask activities', () => {
    const node = makeAdHocSubProcess([
      {
        id: 'Svc_1',
        $type: 'bpmn:ServiceTask',
        extensionElements: {
          values: [
            { $type: 'zeebe:Script', expression: '= fromAi(toolCall.x, "x")' },
          ],
        },
      },
    ]);
    assert.deepEqual(collectReports(node), []);
  });

  it('ignores non-AdHocSubProcess containers', () => {
    const node = {
      id: 'SubProcess_1',
      $type: 'bpmn:SubProcess',
      flowElements: [
        makeScriptTask('Task_1', {
          scriptExpression: '= fromAi(toolCall.x, "desc")',
        }),
      ],
    };
    assert.deepEqual(collectReports(node), []);
  });

  it('reports each violating ScriptTask separately', () => {
    const node = makeAdHocSubProcess([
      makeScriptTask('Task_ok', {
        scriptExpression: '= x',
        inputSources: ['= fromAi(toolCall.x, "x")'],
      }),
      makeScriptTask('Task_bad1', {
        scriptExpression: '= fromAi(toolCall.a, "a")',
      }),
      makeScriptTask('Task_bad2', {
        scriptExpression: '= fromAi(toolCall.b, "b")',
      }),
    ]);
    const reports = collectReports(node);
    assert.equal(reports.length, 2);
    assert.deepEqual(
      reports.map((r) => r.id).sort(),
      ['Task_bad1', 'Task_bad2']
    );
  });
});
