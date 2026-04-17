---
type: "query"
date: "2026-04-17T21:26:04.640329+00:00"
question: "Are the 16 inferred relationships involving runRetrievalPipeline() actually correct?"
contributor: "graphify"
source_nodes: ["runRetrievalPipeline()", "classifyIntent()", "callLLM()", "expandQuery()"]
---

# Q: Are the 16 inferred relationships involving runRetrievalPipeline() actually correct?

## Answer

Verification result: all 16 inferred call relationships are supported by concrete call sites in server/src/services/pipeline/orchestrator.js. However, 12 inferred edges are directionally inverted in graph orientation (callee -> runRetrievalPipeline instead of runRetrievalPipeline -> callee). The 4 inferred outgoing edges that are directionally correct are expandQuery(), rerankCandidates(), selectForContext(), and computeEvidenceStrength().

## Source Nodes

- runRetrievalPipeline()
- classifyIntent()
- callLLM()
- expandQuery()