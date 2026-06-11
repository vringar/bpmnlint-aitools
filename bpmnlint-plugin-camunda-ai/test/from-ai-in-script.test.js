const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const rule = require('../rules/from-ai-in-script')();

function makeScriptTask(id, scriptExpression) {
  return {
    id,
    $type: 'bpmn:ScriptTask',
    extensionElements: {
      values: [
        { $type: 'zeebe:Script', expression: scriptExpression },
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

describe('from-ai-in-script', () => {
  it('reports when script expression contains fromAi()', () => {
    const node = makeScriptTask(
      'Task_1',
      '= fromAi(toolCall.clusterId, "The cluster UUID", "string")'
    );
    const reports = collectReports(node);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Task_1');
    assert.match(reports[0].message, /fromAi\(\) in script expression/);
  });

  it('reports even when fromAi() also appears in a zeebe:input mapping', () => {
    const node = {
      id: 'Task_1',
      $type: 'bpmn:ScriptTask',
      extensionElements: {
        values: [
          { $type: 'zeebe:Script', expression: '= fromAi(toolCall.x, "x")' },
          {
            $type: 'zeebe:IoMapping',
            inputParameters: [{ source: '= fromAi(toolCall.x, "x")' }],
            outputParameters: [],
          },
        ],
      },
    };
    const reports = collectReports(node);
    assert.equal(reports.length, 1);
  });

  it('passes when script expression does not contain fromAi()', () => {
    const node = makeScriptTask('Task_1', '= clusterId');
    assert.deepEqual(collectReports(node), []);
  });

  it('passes for non-ScriptTask nodes', () => {
    const node = {
      id: 'Svc_1',
      $type: 'bpmn:ServiceTask',
      extensionElements: {
        values: [
          { $type: 'zeebe:Script', expression: '= fromAi(toolCall.x, "x")' },
        ],
      },
    };
    assert.deepEqual(collectReports(node), []);
  });

  it('passes when ScriptTask has no extensionElements', () => {
    const node = { id: 'Task_1', $type: 'bpmn:ScriptTask' };
    assert.doesNotThrow(() => collectReports(node));
    assert.deepEqual(collectReports(node), []);
  });

  it('passes when ScriptTask has no zeebe:Script element', () => {
    const node = {
      id: 'Task_1',
      $type: 'bpmn:ScriptTask',
      extensionElements: { values: [] },
    };
    assert.deepEqual(collectReports(node), []);
  });

  it('reports regardless of whether the task is inside an adHocSubProcess', () => {
    const node = makeScriptTask('Task_1', '= fromAi(toolCall.x, "x")');
    assert.equal(collectReports(node).length, 1);
  });
});
