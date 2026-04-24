const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const rule = require('../rules/tool-call-result')();

function makeActivity(id, outputTargets = []) {
  const outputParameters = outputTargets.map((target) => ({ target }));
  return {
    id,
    $type: 'bpmn:ServiceTask',
    extensionElements: {
      values: [
        {
          $type: 'zeebe:IoMapping',
          inputParameters: [],
          outputParameters,
        },
      ],
    },
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

describe('tool-call-result', () => {
  it('passes when activity outputs toolCallResult', () => {
    const node = makeAdHocSubProcess([
      makeActivity('Task_1', ['toolCallResult']),
    ]);
    assert.deepEqual(collectReports(node), []);
  });

  it('passes when activity has toolCallResult among multiple outputs', () => {
    const node = makeAdHocSubProcess([
      makeActivity('Task_1', ['someOther', 'toolCallResult']),
    ]);
    assert.deepEqual(collectReports(node), []);
  });

  it('reports when activity outputs a different variable name', () => {
    const node = makeAdHocSubProcess([
      makeActivity('Task_1', ['myResult']),
    ]);
    const reports = collectReports(node);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Task_1');
    assert.match(reports[0].message, /toolCallResult/);
  });

  it('reports when activity has no outputs at all', () => {
    const node = makeAdHocSubProcess([makeActivity('Task_1', [])]);
    const reports = collectReports(node);
    assert.equal(reports.length, 1);
  });

  it('reports when activity has no extensionElements', () => {
    const node = makeAdHocSubProcess([
      { id: 'Task_1', $type: 'bpmn:ServiceTask' },
    ]);
    const reports = collectReports(node);
    assert.equal(reports.length, 1);
  });

  it('does not report on non-activity elements (e.g. start events)', () => {
    const node = makeAdHocSubProcess([
      { id: 'Start_1', $type: 'bpmn:StartEvent' },
      { id: 'End_1', $type: 'bpmn:EndEvent' },
      { id: 'GW_1', $type: 'bpmn:ExclusiveGateway' },
      { id: 'Flow_1', $type: 'bpmn:SequenceFlow' },
    ]);
    assert.deepEqual(collectReports(node), []);
  });

  it('reports each violating activity separately', () => {
    const node = makeAdHocSubProcess([
      makeActivity('Task_1', ['toolCallResult']),
      makeActivity('Task_2', ['wrongVar']),
      makeActivity('Task_3', []),
    ]);
    const reports = collectReports(node);
    assert.equal(reports.length, 2);
    assert.deepEqual(
      reports.map((r) => r.id).sort(),
      ['Task_2', 'Task_3']
    );
  });

  it('ignores non-AdHocSubProcess nodes', () => {
    const node = {
      id: 'SubProcess_1',
      $type: 'bpmn:SubProcess',
      flowElements: [makeActivity('Task_1', [])],
    };
    assert.deepEqual(collectReports(node), []);
  });

  it('handles AdHocSubProcess with no flowElements', () => {
    const node = { id: 'AdHoc_1', $type: 'bpmn:AdHocSubProcess' };
    assert.doesNotThrow(() => collectReports(node));
    assert.deepEqual(collectReports(node), []);
  });
});
