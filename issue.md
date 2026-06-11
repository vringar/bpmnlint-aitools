**Title:** New rule: warn when `fromAi` is used in `zeebe:script` expression instead of `zeebe:input` mapping

**Problem**

The Camunda AI Agent connector's tool resolver scans `zeebe:ioMapping/zeebe:input` entries to build the JSON Schema it sends to the LLM. When `fromAi` is placed inside a `zeebe:script expression` instead, the resolver silently produces an empty input schema — the LLM sees no parameters and no `required` constraints, so it can invoke the tool without any arguments.

There is currently no lint rule that catches this misplacement.

**Example — broken:**

```xml
<bpmn:scriptTask id="get_cluster_details">
  <bpmn:extensionElements>
    <zeebe:script
      expression="=fromAi(toolCall.clusterId, &quot;The cluster UUID&quot;, &quot;string&quot;)"
      resultVariable="clusterId" />
  </bpmn:extensionElements>
</bpmn:scriptTask>
```

**Example — correct:**

```xml
<bpmn:scriptTask id="get_cluster_details">
  <bpmn:extensionElements>
    <zeebe:ioMapping>
      <zeebe:input
        source="=fromAi(toolCall.clusterId, &quot;The cluster UUID&quot;, &quot;string&quot;)"
        target="clusterId" />
    </zeebe:ioMapping>
    <zeebe:script expression="=clusterId" resultVariable="clusterId" />
  </bpmn:extensionElements>
</bpmn:scriptTask>
```

**Proposed rule**

Flag any `scriptTask` that is a direct child of an `adHocSubProcess` where:
- the `zeebe:script expression` value contains `fromAi(`, **and**
- no `zeebe:ioMapping/zeebe:input` source value contains `fromAi(`

**Suggested message:** `fromAi() in script expression is not visible to the AI Agent tool resolver — move it to a zeebe:input mapping`

**Severity:** error
