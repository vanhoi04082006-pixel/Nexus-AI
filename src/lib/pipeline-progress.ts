// NEXUS AI - Pipeline progress tracker (in-memory)
// Stores live progress of background pipeline runs so the frontend can poll.
// This replaces SSE streaming — polling is far more robust through proxies/gateways.

export interface AgentState {
  id: string;
  name: string;
  status: "pending" | "running" | "done" | "failed";
  error?: string;
}

export interface PipelineProgress {
  projectId: string;
  status: "running" | "done" | "error";
  agents: AgentState[];
  error?: string;
  result?: {
    projectId: string;
    leaderToken: string;
  };
  startedAt: number;
  finishedAt?: number;
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
