// NEXUS AI - Pipeline progress tracker (in-memory)
// Stores live progress of background pipeline runs so the frontend can poll.
// This replaces SSE streaming — polling is far more robust through proxies/gateways.

import { AsyncLocalStorage } from "node:async_hooks";

export interface AgentState {
  id: string;
  name: string;
  status: "pending" | "running" | "done" | "failed";
  error?: string;
}

/* ===========================================================
   Live log entries — visible in ProcessingOverlay
   Each line: timestamp + provider + model + key + status
=========================================================== */
export type LogLevel = "info" | "success" | "warn" | "error";

export interface LogEntry {
  id: string;
  ts: number; // epoch ms
  level: LogLevel;
  agentId?: string; // "01".."08" | "PIPELINE" | "TASK" | "REVIEWER"
  provider?: "openrouter" | "deepseek" | "cache" | "fallback" | "pipeline";
  model?: string;
  keyIndex?: number; // 1-based
  message: string;
}

export interface PipelineProgress {
  projectId: string;
  status: "running" | "done" | "error";
  agents: AgentState[];
  logs: LogEntry[];
  error?: string;
  result?: {
    projectId: string;
    leaderToken: string;
  };
  startedAt: number;
  finishedAt?: number;
}

// AsyncLocalStorage carries the projectId through the entire async pipeline
// (including Promise.all parallel branches) so deep callees (openrouter.ts,
// ai.ts) can append log lines without explicit parameter passing.
const projectIdStorage = new AsyncLocalStorage<string>();

let logSeq = 0;

/**
 * Run a callback inside a pipeline log context. All `appendLog()` calls
 * made anywhere within `fn` (and its async descendants) will be attached
 * to `projectId`'s progress tracker.
 */
export function runWithProjectLog<T>(projectId: string, fn: () => T): T {
  return projectIdStorage.run(projectId, fn);
}

/**
 * Append a log entry to the current pipeline's progress tracker.
 * Safe to call from anywhere — if no pipeline context is active, this is a no-op.
 * Logs are capped at 500 entries (FIFO eviction) to bound memory.
 */
export function appendLog(entry: Omit<LogEntry, "id" | "ts">): void {
  const pid = projectIdStorage.getStore();
  if (!pid) return; // not running inside a pipeline context
  const p = progressMap.get(pid);
  if (!p) return;
  p.logs.push({
    ...entry,
    id: `log-${Date.now()}-${++logSeq}`,
    ts: Date.now(),
  });
  if (p.logs.length > 500) p.logs.shift();
}

// Global map — persists across requests within the same Node.js process.
const progressMap = new Map<string, PipelineProgress>();

export function initProgress(projectId: string): PipelineProgress {
  const p: PipelineProgress = {
    projectId,
    status: "running",
    agents: [
      { id: "01", name: "Requirement Analyst", status: "pending" },
      { id: "02", name: "HR Planner", status: "pending" },
      { id: "03", name: "Sprint Planner", status: "pending" },
      { id: "04", name: "System Architect", status: "pending" },
      { id: "05", name: "UML Generator", status: "pending" },
      { id: "06", name: "Technical Writer", status: "pending" },
      { id: "07", name: "Git / DevOps", status: "pending" },
      { id: "08", name: "Quality Reviewer", status: "pending" },
    ],
    logs: [],
    startedAt: Date.now(),
  };
  progressMap.set(projectId, p);
  return p;
}

export function updateAgent(
  projectId: string,
  agentId: string,
  status: AgentState["status"],
  error?: string
): void {
  const p = progressMap.get(projectId);
  if (!p) return;
  const agent = p.agents.find((a) => a.id === agentId);
  if (agent) {
    agent.status = status;
    if (error) agent.error = error;
  }
}

export function finishProgress(
  projectId: string,
  result?: { projectId: string; leaderToken: string }
): void {
  const p = progressMap.get(projectId);
  if (!p) return;
  p.status = result ? "done" : "error";
  p.result = result;
  p.finishedAt = Date.now();
  // Keep in memory for 5 minutes so the client can read the final state.
  setTimeout(() => {
    progressMap.delete(projectId);
  }, 300000);
}

export function failProgress(projectId: string, error: string): void {
  const p = progressMap.get(projectId);
  if (!p) return;
  p.status = "error";
  p.error = error;
  p.finishedAt = Date.now();
  setTimeout(() => {
    progressMap.delete(projectId);
  }, 300000);
}

export function getProgress(projectId: string): PipelineProgress | null {
  return progressMap.get(projectId) || null;
}

/* ===========================================================
   Refine progress (separate tracker, same pattern)
=========================================================== */
export interface RefineProgress {
  projectId: string;
  status: "running" | "done" | "error";
  sections: Record<string, boolean>;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

const refineMap = new Map<string, RefineProgress>();

export function initRefine(projectId: string): RefineProgress {
  const p: RefineProgress = {
    projectId,
    status: "running",
    sections: {},
    startedAt: Date.now(),
  };
  refineMap.set(projectId, p);
  return p;
}

export function updateRefineSection(projectId: string, section: string, done: boolean): void {
  const p = refineMap.get(projectId);
  if (!p) return;
  p.sections[section] = done;
}

export function finishRefine(projectId: string, error?: string): void {
  const p = refineMap.get(projectId);
  if (!p) return;
  p.status = error ? "error" : "done";
  p.error = error;
  p.finishedAt = Date.now();
  setTimeout(() => refineMap.delete(projectId), 300000);
}

export function getRefine(projectId: string): RefineProgress | null {
  return refineMap.get(projectId) || null;
}

/* ===========================================================
   Initialize (task generation) progress
=========================================================== */
export interface InitProgress {
  projectId: string;
  status: "running" | "done" | "error";
  message: string;
  taskCount?: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

const initMap = new Map<string, InitProgress>();

export function initInitialize(projectId: string): InitProgress {
  const p: InitProgress = {
    projectId,
    status: "running",
    message: "Dang sinh todolist...",
    startedAt: Date.now(),
  };
  initMap.set(projectId, p);
  return p;
}

export function finishInitialize(projectId: string, taskCount?: number, error?: string): void {
  const p = initMap.get(projectId);
  if (!p) return;
  p.status = error ? "error" : "done";
  p.taskCount = taskCount;
  p.error = error;
  p.finishedAt = Date.now();
  setTimeout(() => initMap.delete(projectId), 300000);
}

export function getInitialize(projectId: string): InitProgress | null {
  return initMap.get(projectId) || null;
}
