/**
 * Rule: tool-call-result
 *
 * Each task/subprocess activity inside a bpmn:AdHocSubProcess should output
 * its result into a variable named "toolCallResult". The AI Agent subprocess
 * connector collects results via:
 *   { id: toolCall._meta.id, name: toolCall._meta.name, content: toolCallResult }
 * A different output name means the LLM never receives the tool's response.
 *
 * Severity: info (default — configure as "info" in .bpmnlintrc)
 */

const ACTIVITY_TYPES = new Set([
  'bpmn:Task',
  'bpmn:ServiceTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
  'bpmn:UserTask',
  'bpmn:ScriptTask',
  'bpmn:BusinessRuleTask',
  'bpmn:CallActivity',
  'bpmn:SubProcess',
]);

function hasToolCallResultOutput(element) {
  const extensions = element.extensionElements;
  if (!extensions || !extensions.values) return false;

  const ioMapping = extensions.values.find(
    (v) => v.$type === 'zeebe:IoMapping'
  );
  if (!ioMapping || !ioMapping.outputParameters) return false;

  return ioMapping.outputParameters.some((p) => p.target === 'toolCallResult');
}

module.exports = {
  check(node, reporter) {
    if (node.$type !== 'bpmn:AdHocSubProcess') return;

    const flowElements = node.flowElements || [];
    for (const element of flowElements) {
      if (!ACTIVITY_TYPES.has(element.$type)) continue;

      if (!hasToolCallResultOutput(element)) {
        reporter.report(
          element.id,
          'Tool activity result should be stored in "toolCallResult" for the AI Agent connector to collect it'
        );
      }
    }
  }
};
