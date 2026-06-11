/**
 * Rule: from-ai-in-script
 *
 * fromAi() is not a valid FEEL function and must never appear inside a
 * zeebe:script expression. Move the call to a zeebe:input source and
 * reference the resulting variable in the script expression instead.
 *
 * Severity: error
 */

module.exports = function() {
  return {
    check(node, reporter) {
      if (node.$type !== 'bpmn:ScriptTask') return;

      const extensions = node.extensionElements;
      if (!extensions || !extensions.values) return;

      const script = extensions.values.find((v) => v.$type === 'zeebe:Script');
      if (!script || !script.expression) return;

      if (script.expression.includes('fromAi(')) {
        reporter.report(
          node.id,
          'fromAi() in script expression is not visible to the AI Agent tool resolver — move it to a zeebe:input mapping'
        );
      }
    }
  };
};
