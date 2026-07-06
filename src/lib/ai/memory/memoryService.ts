// ai/memory/memoryService.ts — Shared Memory Service
// In-memory + DB persistence for project knowledge.
// Agents read/write to this shared memory instead of passing full context.
// No Vector DB needed — uses keyword search + JSON storage.

import { db } from "@/lib/db";
import { appendLog } from "@/lib/pipeline-progress";

interface MemoryEntry {
  key: string;
  value: unknown;
  section: string;
  timestamp: number;
}

class MemoryService {
  private cache = new Map<string, MemoryEntry[]>();
  private projectCache = new Map<string, Map<string, MemoryEntry[]>>();

  /** Store a memory entry for a project */
  async remember(projectId: string, key: string, value: unknown, section: string): Promise<void> {
    const entry: MemoryEntry = { key, value, section, timestamp: Date.now() };

    if (!this.projectCache.has(projectId)) {
      this.projectCache.set(projectId, new Map());
    }
    const projMem = this.projectCache.get(projectId)!;
    if (!projMem.has(section)) projMem.set(section, []);
    projMem.get(section)!.push(entry);

    // Limit to 100 entries per section
    if (projMem.get(section)!.length > 100) {
      projMem.get(section)!.shift();
    }
  }

  /** Retrieve a specific memory entry */
  recall(projectId: string, key: string): unknown | null {
    const projMem = this.projectCache.get(projectId);
    if (!projMem) return null;
    for (const entries of projMem.values()) {
      const found = entries.find((e) => e.key === key);
      if (found) return found.value;
    }
    return null;
  }

  /** Search memory by keyword (simple string search) */
  search(projectId: string, query: string): MemoryEntry[] {
    const projMem = this.projectCache.get(projectId);
    if (!projMem) return [];
    const q = query.toLowerCase();
    const results: MemoryEntry[] = [];
    for (const entries of projMem.values()) {
      for (const entry of entries) {
        const str = JSON.stringify(entry.value).toLowerCase();
        if (str.includes(q)) results.push(entry);
      }
    }
    return results.slice(0, 20); // limit results
  }

  /** Get all memory for a project section */
  getSection(projectId: string, section: string): MemoryEntry[] {
    const projMem = this.projectCache.get(projectId);
    if (!projMem) return [];
    return projMem.get(section) || [];
  }

  /** Get a summary of all stored memory for a project */
  getSummary(projectId: string): Record<string, number> {
    const projMem = this.projectCache.get(projectId);
    if (!projMem) return {};
    const summary: Record<string, number> = {};
    for (const [section, entries] of projMem.entries()) {
      summary[section] = entries.length;
    }
    return summary;
  }

  /** Clear memory for a project */
  forget(projectId: string): void {
    this.projectCache.delete(projectId);
    appendLog({ level: "info", agentId: "MEMORY", provider: "pipeline", message: `[MEMORY] Cleared memory for project ${projectId}` });
  }

  /** Persist memory to DB (Analysis table — store as JSON in content) */
  async persist(projectId: string): Promise<void> {
    const projMem = this.projectCache.get(projectId);
    if (!projMem) return;

    const memoryJson = JSON.stringify(
      Array.from(projMem.entries()).map(([section, entries]) => ({ section, entries }))
    );

    // Store in ProjectContext (reuse existing table)
    await db.projectContext.upsert({
      where: { projectId },
      update: { summary: memoryJson.substring(0, 10000) },
      create: { projectId, summary: memoryJson.substring(0, 10000) },
    });

    appendLog({ level: "info", agentId: "MEMORY", provider: "pipeline", message: `[MEMORY] Persisted ${projMem.size} sections to DB` });
  }

  /** Load memory from DB */
  async load(projectId: string): Promise<void> {
    const ctx = await db.projectContext.findUnique({ where: { projectId } });
    if (!ctx || !ctx.summary) return;

    try {
      const data = JSON.parse(ctx.summary) as { section: string; entries: MemoryEntry[] }[];
      const projMem = new Map<string, MemoryEntry[]>();
      for (const { section, entries } of data) {
        projMem.set(section, entries);
      }
      this.projectCache.set(projectId, projMem);
      appendLog({ level: "info", agentId: "MEMORY", provider: "pipeline", message: `[MEMORY] Loaded ${projMem.size} sections from DB` });
    } catch { /* ignore parse errors */ }
  }
}

/** Singleton memory service */
export const memory = new MemoryService();

/**
 * Memory Agent — manages project memory.
 * Called after each agent completes to store its output in shared memory.
 */
export async function memoryAgent(projectId: string, section: string, data: unknown): Promise<void> {
  await memory.remember(projectId, `${section}:latest`, data, section);

  // If analysis, also store modules/features/actors separately for quick retrieval
  if (section === "analysis" && typeof data === "object" && data) {
    const a = data as { modules?: string[]; features?: { name: string }[]; actors?: { name: string }[] };
    if (a.modules) await memory.remember(projectId, "modules", a.modules, "analysis");
    if (a.features) await memory.remember(projectId, "features", a.features.map((f) => f.name), "analysis");
    if (a.actors) await memory.remember(projectId, "actors", a.actors.map((a2) => a2.name), "analysis");
  }

  // If design, store DB tables + API endpoints
  if (section === "design" && typeof data === "object" && data) {
    const d = data as { dbTables?: { name: string }[]; apiEndpoints?: { method: string; path: string }[] };
    if (d.dbTables) await memory.remember(projectId, "dbTables", d.dbTables.map((t) => t.name), "design");
    if (d.apiEndpoints) await memory.remember(projectId, "apiEndpoints", d.apiEndpoints, "design");
  }

  // If HR, store assignments
  if (section === "hr" && typeof data === "object" && data) {
    const h = data as { assignments?: { name: string; role: string; modules: string[] }[] };
    if (h.assignments) await memory.remember(projectId, "assignments", h.assignments, "hr");
  }
}

/**
 * Retrieval Agent — retrieves relevant context from shared memory.
 * Called before an agent runs to provide only relevant data (not full project JSON).
 */
export function retrievalAgent(projectId: string, section: string): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  // Always include modules + features (needed by most agents)
  const modules = memory.recall(projectId, "modules");
  if (modules) context.modules = modules;

  const features = memory.recall(projectId, "features");
  if (features) context.features = features;

  const actors = memory.recall(projectId, "actors");
  if (actors) context.actors = actors;

  // Section-specific retrieval
  if (section === "hr" || section === "sprint") {
    const assignments = memory.recall(projectId, "assignments");
    if (assignments) context.assignments = assignments;
  }

  if (section === "uml" || section === "docs" || section === "test" || section === "security") {
    const dbTables = memory.recall(projectId, "dbTables");
    if (dbTables) context.dbTables = dbTables;

    const apiEndpoints = memory.recall(projectId, "apiEndpoints");
    if (apiEndpoints) context.apiEndpoints = apiEndpoints;
  }

  const summary = memory.getSummary(projectId);
  appendLog({
    level: "info",
    agentId: "RETRIEVAL",
    provider: "pipeline",
    message: `[RETRIEVAL] Retrieved ${Object.keys(context).length} items for section "${section}" — memory: ${JSON.stringify(summary)}`,
  });

  return context;
}
