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
  provider?: "openrouter" | "cache" | "fallback" | "pipeline";
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

// Three independent AsyncLocalStorage contexts — one per background process.
// They can be nested (e.g. a refine run that internally calls the same
// openrouter.ts code), and each call to `appendLog()` will route to the
// innermost active context. This way openrouter.ts / ai.ts stay 100%
// context-agnostic: they just call `appendLog()` and the right tracker
// picks it up.
const pipelineAls = new AsyncLocalStorage<string>();
const initAls = new AsyncLocalStorage<string>();
const refineAls = new AsyncLocalStorage<string>();

let logSeq = 0;

function pushLog(
  map: Map<string, { logs: LogEntry[] }>,
  pid: string,
  entry: Omit<LogEntry, "id" | "ts">
): void {
  const p = map.get(pid);
  if (!p) return;
  p.logs.push({
    ...entry,
    id: `log-${Date.now()}-${++logSeq}`,
    ts: Date.now(),
  });
  if (p.logs.length > 500) p.logs.shift();
}

/**
 * Run a callback inside a pipeline log context. All `appendLog()` calls
 * made anywhere within `fn` (and its async descendants) will be attached
 * to `projectId`'s progress tracker.
 */
export function runWithProjectLog<T>(projectId: string, fn: () => T): T {
  return pipelineAls.run(projectId, fn);
}

/**
 * Run a callback inside an init (task-generation) log context.
 */
export function runWithInitLog<T>(projectId: string, fn: () => T): T {
  return initAls.run(projectId, fn);
}

/**
 * Run a callback inside a refine log context.
 */
export function runWithRefineLog<T>(projectId: string, fn: () => T): T {
  return refineAls.run(projectId, fn);
}

/**
 * Append a log entry to the innermost active log context.
 * Tries refine → init → pipeline in order. Safe to call from anywhere —
 * if no context is active, this is a no-op.
 */
export function appendLog(entry: Omit<LogEntry, "id" | "ts">): void {
  // Refine is innermost-priority (refineSections can run inside a refine
  // context and reuses callAndParse → openrouter.ts which calls appendLog).
  const refinePid = refineAls.getStore();
  if (refinePid) {
    pushLog(refineMap as unknown as Map<string, { logs: LogEntry[] }>, refinePid, entry);
    return;
  }
  const initPid = initAls.getStore();
  if (initPid) {
    pushLog(initMap as unknown as Map<string, { logs: LogEntry[] }>, initPid, entry);
    return;
  }
  const pipePid = pipelineAls.getStore();
  if (pipePid) {
    pushLog(progressMap as unknown as Map<string, { logs: LogEntry[] }>, pipePid, entry);
    return;
  }
  // No active context — silently drop.
}

// Global maps — stored on globalThis so they survive Next.js dev recompiles.
// Without this, a route recompile would create a fresh module instance with
// an empty map, losing all in-flight progress.
type GlobalStore = {
  progressMap?: Map<string, PipelineProgress>;
  refineMap?: Map<string, RefineProgress>;
  initMap?: Map<string, InitProgress>;
  rateLimitedKeys?: Map<number, number>;
  aiCache?: Map<string, { result: string; timestamp: number }>;
};
const g = globalThis as typeof globalThis & GlobalStore;

// Global map — persists across requests within the same Node.js process.
const progressMap: Map<string, PipelineProgress> = g.progressMap ?? new Map<string, PipelineProgress>();
g.progressMap = progressMap;

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
      { id: "08", name: "Software Tester", status: "pending" },
      { id: "09", name: "Security Reviewer", status: "pending" },
      { id: "10", name: "Quality Reviewer", status: "pending" },
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
  logs: LogEntry[];
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

const refineMap: Map<string, RefineProgress> = g.refineMap ?? new Map<string, RefineProgress>();
g.refineMap = refineMap;

export function initRefine(projectId: string): RefineProgress {
  const p: RefineProgress = {
    projectId,
    status: "running",
    sections: {},
    logs: [],
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
  logs: LogEntry[];
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

const initMap: Map<string, InitProgress> = g.initMap ?? new Map<string, InitProgress>();
g.initMap = initMap;

export function initInitialize(projectId: string): InitProgress {
  const p: InitProgress = {
    projectId,
    status: "running",
    message: "Dang sinh todolist...",
    logs: [],
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
