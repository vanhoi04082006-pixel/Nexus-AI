// NEXUS AI — Multi-Agent AI Service (v6.0 — Modular Architecture)
// This file is a thin re-export hub.
// All logic lives in focused modules under src/lib/ai/
//
// Module structure (20 files):
//   ai/config/constants.ts           — Config + helpers
//   ai/prompts/index.ts              — All agent system prompts
//   ai/agents/definitions.ts         — Agent definitions + model lists
//   ai/utils/helpers.ts              — buildCtx, buildReviewSummary
//   ai/utils/jfix.ts                 — JSON repair utility
//   ai/utils/diff.ts                 — Change Impact Analyzer
//   ai/utils/versionManager.ts       — Version Manager
//   ai/utils/dependencyAnalyzer.ts   — Dependency Analyzer + Artifact Reviewer + Prompt Optimizer
//   ai/contracts/agent.ts            — Agent Contract interface
//   ai/contracts/registry.ts         — Plugin Registry
//   ai/plugins/index.ts              — 15 Agent Plugins
//   ai/core/eventBus.ts              — Event Bus (pub/sub)
//   ai/core/workflow.ts              — Workflow DSL (declarative pipeline)
//   ai/memory/memoryService.ts       — Shared Memory + Memory Agent + Retrieval Agent
//   ai/pipeline/runner.ts            — callModel + callAndParse
//   ai/pipeline/fallback.ts          — Fallback data generators
//   ai/pipeline/taskGen.ts           — Task generation + Chat assistant
//   ai/pipeline/refine.ts            — AI Refine sections
//   ai/pipeline/reflection.ts        — Reflection Agent (quality review)
//   ai/pipeline/index.ts             — Main pipeline orchestrator
//   ai/pipeline/dag.ts               — DAG Workflow Engine
//   ai/pipeline/consensus.ts         — Multi-Reviewer Consensus

// Pipeline
export { runPipeline } from "./ai/pipeline";
export { refineSections } from "./ai/pipeline/refine";
export { generateTasks, chatAssistant } from "./ai/pipeline/taskGen";
export { callAndParse, callModel } from "./ai/pipeline/runner";
export type { ParseResult } from "./ai/pipeline/runner";
export { runDag, buildDag, type DagNode, type DagResult } from "./ai/pipeline/dag";
export { runConsensusReview, type ReviewResult, type ReviewerRole } from "./ai/pipeline/consensus";
export { reflect, type ReflectionResult } from "./ai/pipeline/reflection";

// Agent Contract + Plugin System
export { type AgentContract, type AgentManifest, type AgentInput, type AgentOutput, createAgent } from "./ai/contracts/agent";
export { registry } from "./ai/contracts/registry";
export { registerAllPlugins } from "./ai/plugins";

// Core
export { eventBus, type PipelineEvent, type EventPayload } from "./ai/core/eventBus";
export { executeWorkflow, NEXUS_WORKFLOW, type WorkflowStep, type WorkflowResult } from "./ai/core/workflow";

// Memory
export { memory, memoryAgent, retrievalAgent } from "./ai/memory/memoryService";

// Utils
export { buildCtx, buildReviewSummary, isValidSchema } from "./ai/utils/helpers";
export { JFix } from "./ai/utils/jfix";
export { diffSections, analyzeImpact, type ChangeDiff, type ImpactAnalysis } from "./ai/utils/diff";
export { saveVersion, getVersionHistory, getCurrentVersion, type ArtifactVersion } from "./ai/utils/versionManager";
export { analyzeDependencies, reviewArtifact, optimizePrompt, type DependencyReport } from "./ai/utils/dependencyAnalyzer";

// Cache + Queue
export { semanticCache } from "./ai/cache/semanticCache";
export { taskQueue, type QueueTask } from "./ai/queue/taskQueue";

// Config
export { AGENTS, type AgentDef } from "./ai/agents/definitions";
export { PROMPT_MAP } from "./ai/prompts";
export { fallback } from "./ai/pipeline/fallback";
export {
  JSON_INSTRUCTION, FEW_SHOT_NOTE, compressContext,
  getAdaptiveTimeout, jitteredDelay, wait,
  REQ_TIMEOUT, MAX_RETRIES, RATE_LIMIT_DELAY, MAX_CONCURRENCY,
} from "./ai/config/constants";
