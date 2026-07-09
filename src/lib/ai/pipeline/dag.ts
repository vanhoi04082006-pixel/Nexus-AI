// ai/pipeline/dag.ts — DAG Workflow Engine
// Replaces the hardcoded for-loop pipeline with a dependency graph.
// Each agent declares its dependencies; the scheduler runs agents
// as soon as their dependencies are met (max parallelism).

import type { SectionType } from "@/lib/types";
import { appendLog } from "@/lib/pipeline-progress";
import { AGENTS, type AgentDef } from "../agents/definitions";
import { PROMPT_MAP } from "../prompts";
import { buildCtx, isValidSchema } from "../utils/helpers";
import { callAndParse, type ParseResult } from "./runner";
import { fallback } from "./fallback";

// ===== DAG Types =====
export interface DagNode {
  agent: AgentDef;
  dependencies: string[]; // keys of agents that must complete first
  status: "pending" | "running" | "done" | "failed";
  result?: ParseResult | null;
}

export interface DagResult {
  results: Record<string, unknown>;
  failed: AgentDef[];
  duration: number;
}

// ===== Dependency Graph Definition =====
// Defines which agents depend on which.
// This replaces the hardcoded "Phase 1 → Phase 2 → Phase 3" sequence.
const DEPENDENCY_GRAPH: Record<string, string[]> = {
  analysis: [],           // No dependencies — runs first
  hr: ["analysis"],       // Needs analysis (modules, features)
  sprint: ["analysis", "hr"], // Needs analysis + HR assignments
  design: ["analysis"],   // Needs analysis (modules, actors)
  uml: ["design"],        // Needs design (DB tables, API endpoints)
  docs: ["design"],       // Needs design (folder structure, tech stack)
  git: ["analysis"],      // Needs analysis (modules)
  test: ["design"],       // Needs design (API endpoints)
  security: ["design"],   // Needs design (API, DB)
};

/**
 * Build the DAG from agent definitions + dependency graph.
 * Only includes agents that exist in AGENTS array.
 */
export function buildDag(): DagNode[] {
  return AGENTS
    .filter((a) => a.key !== "security" || a.id === "09") // Exclude reviewer (agent 10)
    .map((agent) => ({
      agent,
      dependencies: DEPENDENCY_GRAPH[agent.key] || [],
      status: "pending" as const,
    }));
}

/**
 * Check if a node's dependencies are all satisfied.
 */
function dependenciesMet(node: DagNode, completed: Set<string>): boolean {
  return node.dependencies.every((dep) => completed.has(dep));
}

/**
 * Run the DAG workflow engine.
 * Executes agents in dependency order, maximizing parallelism.
 * Agents with no unmet dependencies run immediately in parallel.
 */
export async function runDag(
  input: import("@/lib/types").ProjectInput,
  results: Record<string, unknown>,
  onProgress?: (ev: { type: string; id: string; name: string; index: number; total: number; error?: string }) => void
): Promise<DagResult> {
  const t0 = Date.now();
  const dag = buildDag();
  const failed: AgentDef[] = [];
  const completed = new Set<string>();
  const total = dag.length;

  appendLog({
    level: "info",
    agentId: "DAG",
    provider: "pipeline",
    message: `▶ [DAG] Workflow engine started — ${total} nodes, max parallelism`,
  });

  // Log the dependency graph
  for (const node of dag) {
    const deps = node.dependencies.length > 0 ? node.dependencies.join(", ") : "(none)";
    appendLog({
      level: "info",
      agentId: "DAG",
      provider: "pipeline",
      message: `  📐 ${node.agent.id} ${node.agent.name} ← depends: ${deps}`,
    });
  }

  // Main scheduling loop
  while (dag.some((n) => n.status === "pending")) {
    // Find all nodes whose dependencies are met
    const ready = dag.filter((n) => n.status === "pending" && dependenciesMet(n, completed));

    if (ready.length === 0) {
      // Deadlock — shouldn't happen with a valid DAG
      appendLog({ level: "error", agentId: "DAG", provider: "pipeline", message: `✗ [DAG] Deadlock — no nodes ready but pending exist` });
      break;
    }

    // Run all ready nodes in parallel
    appendLog({
      level: "info",
      agentId: "DAG",
      provider: "pipeline",
      message: `▶ [DAG] Running ${ready.length} agent(s) in parallel: ${ready.map((n) => n.agent.name).join(", ")}`,
    });

    const promises = ready.map(async (node) => {
      node.status = "running";
      const i = dag.indexOf(node);
      onProgress?.({ type: "agent_start", id: node.agent.id, name: node.agent.name, index: i, total });

      const ctx = buildCtx(node.agent.key, results as never, input);
      const res = await callAndParse(node.agent.models, PROMPT_MAP[node.agent.key](), ctx, node.agent.temp, node.agent.key);

      if (res && isValidSchema(res.data, node.agent.key)) {
        results[node.agent.key] = res.data;
        node.status = "done";
        node.result = res;
        completed.add(node.agent.key);
        onProgress?.({ type: "agent_done", id: node.agent.id, name: node.agent.name, index: i, total });
        appendLog({ level: "success", agentId: node.agent.id, provider: "pipeline", model: res.model, message: `✓ [AGENT-${node.agent.id}] ${node.agent.name} → done (${res.model})` });
      } else if (res) {
        results[node.agent.key] = res.data;
        node.status = "done";
        node.result = res;
        completed.add(node.agent.key);
        onProgress?.({ type: "agent_done", id: node.agent.id, name: node.agent.name, index: i, total });
        appendLog({ level: "warn", agentId: node.agent.id, provider: "pipeline", model: res.model, message: `⚠ [AGENT-${node.agent.id}] ${node.agent.name} → schema invalid, saved` });
      } else {
        node.status = "failed";
        node.result = null;
        // Still mark as completed so dependents can run (with fallback)
        completed.add(node.agent.key);
        failed.push(node.agent);
        onProgress?.({ type: "agent_fail", id: node.agent.id, name: node.agent.name, index: i, total });
        appendLog({ level: "error", agentId: node.agent.id, provider: "pipeline", message: `✗ [AGENT-${node.agent.id}] ${node.agent.name} → ALL MODELS FAILED` });
      }
    });

    await Promise.all(promises);
  }

  // Apply fallbacks for failed agents
  for (const ag of failed) {
    if (!results[ag.key]) {
      appendLog({ level: "warn", agentId: ag.id, provider: "fallback", message: `▷ FALLBACK: ${ag.name}` });
      results[ag.key] = fallback(ag.key, input, results as never);
      appendLog({ level: "success", agentId: ag.id, provider: "fallback", message: `✓ [AGENT-${ag.id}] ${ag.name} → done (fallback)` });
    }
  }

  const duration = Date.now() - t0;
  appendLog({
    level: "success",
    agentId: "DAG",
    provider: "pipeline",
    message: `✓ [DAG] Workflow complete — ${total - failed.length}/${total} succeeded, ${failed.length} fallback, ${(duration / 1000).toFixed(1)}s`,
  });

  return { results, failed, duration };
}
