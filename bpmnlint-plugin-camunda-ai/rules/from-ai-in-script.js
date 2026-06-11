/**
 * Rule: from-ai-in-script
 *
 * A zeebe:script expression containing fromAi() is invisible to the AI Agent
 * connector's tool resolver — it only scans zeebe:input mappings to build the
 * JSON Schema sent to the LLM. Move the fromAi() call to a zeebe:input source
 * and reference the resulting variable in the script expression instead.
 *
 * Severity: error
 */

function scriptExpression(element) {
  const extensions = element.extensionElements;
  if (!extensions || !extensions.values) return null;

  const script = extensions.values.find((v) => v.$type === 'zeebe:Script');
  return script ? script.expression || null : null;
}

function hasFromAiInInputMapping(element) {
  const extensions = element.extensionElements;
  if (!extensions || !extensions.values) return false;

  const ioMapping = extensions.values.find(
    (v) => v.$type === 'zeebe:IoMapping'
  );
  if (!ioMapping || !ioMapping.inputParameters) return false;

  return ioMapping.inputParameters.some(
    (p) => p.source && p.source.includes('fromAi(')
  );
}

module.exports = function() {
  return {
    check(node, reporter) {
      if (node.$type !== 'bpmn:AdHocSubProcess') return;

      const flowElements = node.flowElements || [];
      for (const element of flowElements) {
        if (element.$type !== 'bpmn:ScriptTask') continue;

        const expr = scriptExpression(element);
        if (!expr || !expr.includes('fromAi(')) continue;

        if (!hasFromAiInInputMapping(element)) {
          reporter.report(
            element.id,
            'fromAi() in script expression is not visible to the AI Agent tool resolver — move it to a zeebe:input mapping'
          );
        }
      }
    }
  };
};
