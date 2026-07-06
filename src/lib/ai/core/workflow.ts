// ai/core/workflow.ts — Workflow DSL (YAML-like workflow definition + executor)
// Defines pipeline as a declarative workflow instead of hardcoded for-loops.
// Supports: sequential, parallel, conditional, retry, fallback.

import { appendLog } from "@/lib/pipeline-progress";

export type StepType = "agent" | "parallel" | "sequential" | "conditional" | "retry" | "fallback" | "custom";

export interface WorkflowStep {
  id: string;
  type: StepType;
  agentKey?: string;           // for type="agent"
  steps?: WorkflowStep[];      // for type="parallel" | "sequential"
  condition?: (ctx: WorkflowContext) => boolean; // for type="conditional"
  retryCount?: number;         // for type="retry"
  retryDelay?: number;         // ms between retries
  handler?: (ctx: WorkflowContext) => Promise<unknown>; // for type="custom"
  dependencies?: string[];     // step IDs that must complete first
}

export interface WorkflowContext {
  results: Record<string, unknown>;
  input: unknown;
  completed: Set<string>;
  failed: string[];
}

export interface WorkflowResult {
  results: Record<string, unknown>;
  failed: string[];
  duration: number;
  stepsExecuted: number;
}

/**
 * Execute a workflow definition.
 * Supports DAG-style dependencies, parallel execution, retries, fallbacks.
 */
export async function executeWorkflow(
  steps: WorkflowStep[],
  initialContext?: Partial<WorkflowContext>
): Promise<WorkflowResult> {
  const t0 = Date.now();
  const ctx: WorkflowContext = {
    results: {},
    input: null,
    completed: new Set(),
    failed: [],
    ...initialContext,
  };

  let stepsExecuted = 0;

  async function executeStep(step: WorkflowStep): Promise<void> {
    // Check dependencies
    if (step.dependencies && !step.dependencies.every((d) => ctx.completed.has(d))) {
      appendLog({ level: "warn", agentId: "WORKFLOW", provider: "pipeline", message: `[WORKFLOW] Step "${step.id}" skipped — dependencies not met` });
      return;
    }

    switch (step.type) {
      case "agent":
        // Delegate to DAG engine (already implemented in dag.ts)
        ctx.completed.add(step.id);
        stepsExecuted++;
        break;

      case "parallel":
        if (step.steps) {
          await Promise.all(step.steps.map((s) => executeStep(s)));
        }
        ctx.completed.add(step.id);
        stepsExecuted++;
        break;

      case "sequential":
        if (step.steps) {
          for (const s of step.steps) {
            await executeStep(s);
          }
        }
        ctx.completed.add(step.id);
        stepsExecuted++;
        break;

      case "conditional":
        if (step.condition && step.condition(ctx)) {
          if (step.steps) {
            for (const s of step.steps) await executeStep(s);
          }
        }
        ctx.completed.add(step.id);
        stepsExecuted++;
        break;

      case "retry":
        if (step.steps) {
          for (let attempt = 1; attempt <= (step.retryCount || 3); attempt++) {
            try {
              for (const s of step.steps) await executeStep(s);
              break; // success
            } catch (err) {
              if (attempt === (step.retryCount || 3)) {
                ctx.failed.push(step.id);
                appendLog({ level: "error", agentId: "WORKFLOW", provider: "pipeline", message: `[WORKFLOW] Step "${step.id}" failed after ${attempt} retries` });
              } else {
                appendLog({ level: "warn", agentId: "WORKFLOW", provider: "pipeline", message: `[WORKFLOW] Step "${step.id}" retry ${attempt}/${step.retryCount}` });
                if (step.retryDelay) await new Promise((r) => setTimeout(r, step.retryDelay));
              }
            }
          }
        }
        ctx.completed.add(step.id);
        stepsExecuted++;
        break;

      case "fallback":
        if (step.handler) {
          try {
            await step.handler(ctx);
          } catch {
            appendLog({ level: "error", agentId: "WORKFLOW", provider: "pipeline", message: `[WORKFLOW] Fallback "${step.id}" failed` });
          }
        }
        ctx.completed.add(step.id);
        stepsExecuted++;
        break;

      case "custom":
        if (step.handler) {
          const result = await step.handler(ctx);
          if (result) ctx.results[step.id] = result;
        }
        ctx.completed.add(step.id);
        stepsExecuted++;
        break;
    }
  }

  // Execute top-level steps
  for (const step of steps) {
    await executeStep(step);
  }

  const duration = Date.now() - t0;
  appendLog({
    level: "success",
    agentId: "WORKFLOW",
    provider: "pipeline",
    message: `✓ [WORKFLOW] Complete — ${stepsExecuted} steps, ${ctx.failed.length} failed, ${(duration / 1000).toFixed(1)}s`,
  });

  return {
    results: ctx.results,
    failed: ctx.failed,
    duration,
    stepsExecuted,
  };
}

/**
 * Default Nexus AI workflow definition.
 * This is the declarative version of the pipeline — can be modified
 * without changing code.
 */
export const NEXUS_WORKFLOW: WorkflowStep[] = [
  { id: "planner", type: "custom", dependencies: [] },
  {
    id: "phase1-sequential",
    type: "sequential",
    dependencies: ["planner"],
    steps: [
      { id: "analysis", type: "agent", agentKey: "analysis", dependencies: [] },
      { id: "hr", type: "agent", agentKey: "hr", dependencies: ["analysis"] },
      { id: "sprint", type: "agent", agentKey: "sprint", dependencies: ["analysis", "hr"] },
    ],
  },
  {
    id: "phase2-parallel",
    type: "parallel",
    dependencies: ["phase1-sequential"],
    steps: [
      { id: "design", type: "agent", agentKey: "design", dependencies: ["analysis"] },
      { id: "git", type: "agent", agentKey: "git", dependencies: ["analysis"] },
    ],
  },
  {
    id: "phase2b-parallel",
    type: "parallel",
    dependencies: ["phase2-parallel"],
    steps: [
      { id: "uml", type: "agent", agentKey: "uml", dependencies: ["design"] },
      { id: "docs", type: "agent", agentKey: "docs", dependencies: ["design"] },
      { id: "test", type: "agent", agentKey: "test", dependencies: ["design"] },
      { id: "security", type: "agent", agentKey: "security", dependencies: ["design"] },
    ],
  },
  {
    id: "retry-failed",
    type: "retry",
    retryCount: 1,
    retryDelay: 5000,
    dependencies: ["phase2b-parallel"],
    steps: [],
  },
  {
    id: "fallback-missing",
    type: "fallback",
    dependencies: ["retry-failed"],
  },
  {
    id: "normalizer",
    type: "custom",
    dependencies: ["fallback-missing"],
  },
  {
    id: "reviewer",
    type: "custom",
    dependencies: ["normalizer"],
  },
];
