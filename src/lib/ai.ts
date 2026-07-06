// NEXUS AI — Multi-Agent AI Service
// This file is now a thin re-export hub.
// All logic has been extracted into focused modules under src/lib/ai/
//
// Module structure:
//   ai/config/constants.ts       — Configuration + helpers
//   ai/prompts/index.ts          — All agent system prompts
//   ai/agents/definitions.ts     — Agent definitions + model lists
//   ai/utils/helpers.ts          — buildCtx, buildReviewSummary, validation
//   ai/utils/jfix.ts             — JSON repair utility
//   ai/utils/diff.ts             — Change Impact Analyzer (diff engine)
//   ai/utils/versionManager.ts   — Version Manager (artifact versioning)
//   ai/contracts/agent.ts        — Agent Contract interface
//   ai/contracts/registry.ts     — Plugin Registry (auto-discovery)
//   ai/plugins/index.ts          — Agent Plugin definitions (15 agents)
//   ai/pipeline/runner.ts        — callModel + callAndParse (retry engine)
//   ai/pipeline/fallback.ts      — Fallback data generators
//   ai/pipeline/taskGen.ts       — Task generation + Chat assistant
//   ai/pipeline/refine.ts        — AI Refine sections
//   ai/pipeline/index.ts         — Main pipeline orchestrator (runPipeline)
//   ai/pipeline/dag.ts           — DAG Workflow Engine (dependency graph)
//   ai/pipeline/consensus.ts     — Multi-Reviewer Consensus Engine

export { runPipeline } from "./ai/pipeline";
export { refineSections } from "./ai/pipeline/refine";
export { generateTasks, chatAssistant } from "./ai/pipeline/taskGen";
export { callAndParse, callModel } from "./ai/pipeline/runner";
export type { ParseResult } from "./ai/pipeline/runner";
export { AGENTS, type AgentDef } from "./ai/agents/definitions";
export { PROMPT_MAP } from "./ai/prompts";
export { fallback } from "./ai/pipeline/fallback";
export { buildCtx, buildReviewSummary, isValidSchema } from "./ai/utils/helpers";
export { JFix } from "./ai/utils/jfix";
export { runDag, buildDag, type DagNode, type DagResult } from "./ai/pipeline/dag";
export { runConsensusReview, type ReviewResult, type ReviewerRole } from "./ai/pipeline/consensus";

// Agent Contract + Plugin System
export { type AgentContract, type AgentManifest, type AgentInput, type AgentOutput, createAgent } from "./ai/contracts/agent";
export { registry } from "./ai/contracts/registry";
export { registerAllPlugins } from "./ai/plugins";

// Change Impact Analyzer + Version Manager
export { diffSections, analyzeImpact, type ChangeDiff, type ImpactAnalysis } from "./ai/utils/diff";
export { saveVersion, getVersionHistory, getCurrentVersion, type ArtifactVersion } from "./ai/utils/versionManager";

// Config
export {
  JSON_INSTRUCTION, FEW_SHOT_NOTE, compressContext,
  getAdaptiveTimeout, jitteredDelay, wait,
  REQ_TIMEOUT, MAX_RETRIES, RATE_LIMIT_DELAY, MAX_CONCURRENCY,
} from "./ai/config/constants";
