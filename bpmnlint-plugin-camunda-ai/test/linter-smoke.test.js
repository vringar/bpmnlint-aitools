const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Linter = require('bpmnlint/lib/linter');
const StaticResolver = require('bpmnlint/lib/resolver/static-resolver');
const { BpmnModdle } = require('bpmn-moddle');
const zeebeModdle = require('zeebe-bpmn-moddle/resources/zeebe.json');

const fromAiToolCall = require('../rules/from-ai-tool-call');
const toolCallResult = require('../rules/tool-call-result');

const resolver = new StaticResolver({
  'rule:bpmnlint-plugin-camunda-ai/from-ai-tool-call': fromAiToolCall,
  'rule:bpmnlint-plugin-camunda-ai/tool-call-result': toolCallResult,
});

const config = {
  rules: {
    'camunda-ai/from-ai-tool-call': 'error',
    'camunda-ai/tool-call-result': 'info',
  },
};

const NS_DEFS =
  'xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
  'xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" ' +
  'xmlns:modeler="http://camunda.org/schema/modeler/1.0" ' +
  'id="Defs" targetNamespace="http://camunda.org/examples" ' +
  'modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.6.0"';

async function lint(xml) {
  const moddle = new BpmnModdle({ zeebe: zeebeModdle });
  const { rootElement: definitions } = await moddle.fromXML(xml);
  const linter = new Linter({ resolver, config });
  return linter.lint(definitions);
}

describe('bpmnlint integration', () => {
  it('invokes rules through the Linter (catches factory-shape regressions)', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions ${NS_DEFS}>
  <process id="P" isExecutable="true">
    <serviceTask id="Task_1">
      <extensionElements>
        <zeebe:ioMapping>
          <zeebe:input source="=fromAi(wrongRef.foo)" target="x" />
        </zeebe:ioMapping>
      </extensionElements>
    </serviceTask>
  </process>
</definitions>`;
    const results = await lint(xml);
    const reports = results['camunda-ai/from-ai-tool-call'] || [];
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Task_1');
    assert.match(reports[0].message, /toolCall\./);
  });

  it('tool-call-result flags adhoc children missing toolCallResult output', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions ${NS_DEFS}>
  <process id="P" isExecutable="true">
    <adHocSubProcess id="AdHoc_1">
      <serviceTask id="Task_A">
        <extensionElements>
          <zeebe:ioMapping>
            <zeebe:output source="=1" target="wrongName" />
          </zeebe:ioMapping>
        </extensionElements>
      </serviceTask>
    </adHocSubProcess>
  </process>
</definitions>`;
    const results = await lint(xml);
    const reports = results['camunda-ai/tool-call-result'] || [];
    assert.equal(reports.length, 1);
    assert.equal(reports[0].id, 'Task_A');
  });

  it('clean diagram produces no reports', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions ${NS_DEFS}>
  <process id="P" isExecutable="true">
    <adHocSubProcess id="AdHoc_1">
      <serviceTask id="Task_OK">
        <extensionElements>
          <zeebe:ioMapping>
            <zeebe:input source="=fromAi(toolCall.query)" target="q" />
            <zeebe:output source="=1" target="toolCallResult" />
          </zeebe:ioMapping>
        </extensionElements>
      </serviceTask>
    </adHocSubProcess>
  </process>
</definitions>`;
    const results = await lint(xml);
    assert.deepEqual(results['camunda-ai/from-ai-tool-call'] || [], []);
    assert.deepEqual(results['camunda-ai/tool-call-result'] || [], []);
  });
});
