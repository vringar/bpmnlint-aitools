/**
 * Rule: from-ai-tool-call
 *
 * Every fromAi() call in a zeebe:input source expression must have its first
 * argument reference toolCall.<paramName>. The toolCall context is injected by
 * the AI Agent connector — any other reference will silently fail at runtime.
 *
 * Severity: error (default)
 */

// Captures the first argument of fromAi(...)
// Safe because toolCall.foo never contains commas or parens.
const FROM_AI_RE = /fromAi\s*\(\s*([^,)]+)/g;

function getFirstArgs(expression) {
  const results = [];
  const source = expression.replace(/^=\s*/, ''); // strip leading "= "
  let match;
  FROM_AI_RE.lastIndex = 0;
  while ((match = FROM_AI_RE.exec(source)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

function isValidFirstArg(arg) {
  // Must be toolCall.<something> — bare "toolCall" is not valid
  return /^toolCall\.[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(arg);
}

module.exports = function() {
  return {
    check(node, reporter) {
      const extensions = node.extensionElements;
      if (!extensions || !extensions.values) return;

      const ioMapping = extensions.values.find(
        (v) => v.$type === 'zeebe:IoMapping'
      );
      if (!ioMapping || !ioMapping.inputParameters) return;

      for (const param of ioMapping.inputParameters) {
        const source = param.source;
        if (!source || !source.includes('fromAi')) continue;

        for (const firstArg of getFirstArgs(source)) {
          if (!isValidFirstArg(firstArg)) {
            reporter.report(
              node.id,
              `fromAi() first argument must reference toolCall.<param>, found: "${firstArg}"`
            );
          }
        }
      }
    }
  };
};
