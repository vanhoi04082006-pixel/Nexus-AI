// ai/pipeline/index.ts — Main pipeline orchestrator (runPipeline)
// Extracted from ai.ts Phase 2

import { appendLog } from "@/lib/pipeline-progress";
import { validateSection } from "@/lib/schemas";
import { getModelHealth } from "@/lib/openrouter";
import type { ProjectInput, ProjectResult, SectionType } from "@/lib/types";
import {
  JSON_INSTRUCTION, FEW_SHOT_NOTE, compressContext, wait,
} from "../config/constants";
import { AGENTS, REVIEWER_MODELS, type AgentDef } from "../agents/definitions";
import { PROMPT_MAP } from "../prompts";
import { buildCtx, buildReviewSummary, isValidSchema } from "../utils/helpers";
import { callAndParse } from "./runner";
import { fallback } from "./fallback";

export async function runPipeline(
  input: ProjectInput,
  onProgress?: (ev: {
    type: string; id: string; name: string; index: number; total: number; error?: string;
  }) => void
): Promise<ProjectResult> {
  const results: Partial<ProjectResult> = {};
  const failed: AgentDef[] = [];
  const t0 = Date.now();
  const total = AGENTS.length + 1;

  // ===== PHASE 0: Planner Agent =====
  appendLog({ level: "info", agentId: "PLANNER", provider: "pipeline", message: `▶ [PLANNER] Decomposing topic into modules...` });

  const plannerResult = await callAndParse(
    ["openai/gpt-oss-120b:free", "nvidia/nemotron-3-super-120b-a12b:free", "google/gemma-4-31b-it:free"],
    `Ban la Project Planner. Nhiem vu: chia nho chu de du an thanh cac module cu the.\n${JSON_INSTRUCTION}\n${FEW_SHOT_NOTE}\nTra object voi:\n- "modules" (array string): 8-15 module cu the\n- "priority" (array string): thu tu uu tien\n- "domain" (string): linh vuc\n- "keywords" (array string): tu khoa`,
    `Du an: ${input.topic}\nMo ta: ${input.description}\nMuc dich: ${input.purpose}\n\nHay chia nho du an thanh cac module cu the:`,
    0.2, undefined
  );

  if (plannerResult && plannerResult.data) {
    const plan = plannerResult.data as { modules?: string[] };
    if (plan.modules && plan.modules.length > 0) {
      appendLog({ level: "success", agentId: "PLANNER", provider: "pipeline", model: plannerResult.model, message: `✓ [PLANNER] ${plan.modules.length} modules: ${plan.modules.join(", ")}` });
      const toArray = (v: unknown): string[] => {
        if (Array.isArray(v)) return v.map(String);
        if (typeof v === "string") return v.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
        return [];
      };
      const existingReqs = toArray(input.extraInfo.requirements);
      const planModules = plan.modules.map((m) => `Module: ${m}`);
      input = { ...input, extraInfo: { ...input.extraInfo, requirements: [...planModules, ...existingReqs].join("\n") } };
    }
  } else {
    appendLog({ level: "warn", agentId: "PLANNER", provider: "pipeline", message: `⚠ [PLANNER] Failed — Analysis will run without pre-planning` });
  }

  // ===== PHASE 1: Sequential (analysis → hr → sprint) =====
  const phase1Agents = AGENTS.filter((a) => ["analysis", "hr", "sprint"].includes(a.key));
  const phase2Agents = AGENTS.filter((a) => ["design", "uml", "docs", "git"].includes(a.key));
  const phase3Agents = AGENTS.filter((a) => ["test", "security"].includes(a.key));
  const parallel = input.parallel !== false;

  async function runAgent(ag: AgentDef): Promise<{ ag: AgentDef; res: import("./runner").ParseResult | null; failed: boolean }> {
    const i = AGENTS.indexOf(ag);
    onProgress?.({ type: "agent_start", id: ag.id, name: ag.name, index: i, total });
    const modeLabel = parallel ? "parallel" : "sequential";
    appendLog({ level: "info", agentId: ag.id, provider: "pipeline", message: `[AGENT-${ag.id}] ${ag.name} → start (${modeLabel})` });

    const ctx = buildCtx(ag.key, results, input);
    const res = await callAndParse(ag.models, PROMPT_MAP[ag.key](), ctx, ag.temp, ag.key);

    if (res && isValidSchema(res.data, ag.key)) {
      (results as Record<string, unknown>)[ag.key] = res.data;
      onProgress?.({ type: "agent_done", id: ag.id, name: ag.name, index: i, total });
      appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model: res.model, message: `✓ [AGENT-${ag.id}] ${ag.name} → done (${res.model})` });
      return { ag, res, failed: false };
    } else if (res) {
      (results as Record<string, unknown>)[ag.key] = res.data;
      onProgress?.({ type: "agent_done", id: ag.id, name: ag.name, index: i, total });
      appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", model: res.model, message: `⚠ [AGENT-${ag.id}] ${ag.name} → schema invalid, saved anyway` });
      return { ag, res, failed: false };
    } else {
      onProgress?.({ type: "agent_fail", id: ag.id, name: ag.name, index: i, total });
      appendLog({ level: "error", agentId: ag.id, provider: "pipeline", message: `✗ [AGENT-${ag.id}] ${ag.name} → ALL MODELS FAILED` });
      return { ag, res: null, failed: true };
    }
  }

  for (const ag of phase1Agents) {
    appendLog({ level: "info", agentId: ag.id, provider: "pipeline", message: `─────────────────────────────────────────────` });
    const r = await runAgent(ag);
    if (r.failed) failed.push(r.ag);
  }

  // ===== PHASE 2 + 3 =====
  if (parallel) {
    appendLog({ level: "info", agentId: "PIPELINE", provider: "pipeline", message: `▶ PHASE 2: ${phase2Agents.length} agents in parallel` });
    const phase2Results = await Promise.all(phase2Agents.map((ag) => runAgent(ag)));
    for (const r of phase2Results) if (r.failed) failed.push(r.ag);

    appendLog({ level: "info", agentId: "PIPELINE", provider: "pipeline", message: `▶ PHASE 3: ${phase3Agents.length} agents in parallel` });
    const phase3Results = await Promise.all(phase3Agents.map((ag) => runAgent(ag)));
    for (const r of phase3Results) if (r.failed) failed.push(r.ag);
  } else {
    appendLog({ level: "info", agentId: "PIPELINE", provider: "pipeline", message: `▶ SEQUENTIAL MODE` });
    for (const ag of [...phase2Agents, ...phase3Agents]) {
      appendLog({ level: "info", agentId: ag.id, provider: "pipeline", message: `─────────────────────────────────────────────` });
      const r = await runAgent(ag);
      if (r.failed) failed.push(r.ag);
    }
  }

  // ===== PHASE 4: Retry failed =====
  if (failed.length > 0) {
    appendLog({ level: "warn", agentId: "PIPELINE", provider: "pipeline", message: `▶ RETRY: ${failed.length} agent(s) failed, retrying after 5s` });
    for (const ag of failed) {
      onProgress?.({ type: "agent_start", id: ag.id, name: `${ag.name} (Retry)`, index: 7, total });
      appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", message: `[AGENT-${ag.id}] ${ag.name} → retry in 5s...` });
      await wait(5000);
      const ctx = buildCtx(ag.key, results, input);
      const res = await callAndParse(ag.models, PROMPT_MAP[ag.key](), ctx, ag.temp, ag.key);
      if (res && isValidSchema(res.data, ag.key)) {
        (results as Record<string, unknown>)[ag.key] = res.data;
        onProgress?.({ type: "agent_done", id: ag.id, name: `${ag.name} (Retry)`, index: 7, total });
        appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model: res.model, message: `✓ [RETRY-${ag.id}] ${ag.name} → done (${res.model})` });
      } else if (res) {
        (results as Record<string, unknown>)[ag.key] = res.data;
        onProgress?.({ type: "agent_done", id: ag.id, name: `${ag.name} (Retry)`, index: 7, total });
        appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", model: res.model, message: `⚠ [RETRY-${ag.id}] ${ag.name} → schema invalid, saved` });
      } else {
        onProgress?.({ type: "agent_fail", id: ag.id, name: `${ag.name} (Retry)`, index: 7, total });
        appendLog({ level: "error", agentId: ag.id, provider: "pipeline", message: `✗ [RETRY-${ag.id}] ${ag.name} → STILL FAIL` });
      }
    }
  }

  // ===== PHASE 5: Required check + fallback =====
  const requiredAgents = AGENTS.filter((a) => a.required);
  const reqMiss = requiredAgents.filter((a) => !results[a.key]);
  if (reqMiss.length === requiredAgents.length) {
    throw new Error("Tat ca Agent bat buoc (Analyst + Architect) deu fail. Thu lai sau 30 giay.");
  }

  for (const ag of AGENTS) {
    if (!results[ag.key]) {
      const i = AGENTS.indexOf(ag);
      appendLog({ level: "warn", agentId: ag.id, provider: "fallback", message: `▷ FALLBACK: ${ag.name} → using static fallback data` });
      (results as Record<string, unknown>)[ag.key] = fallback(ag.key, input, results);
      onProgress?.({ type: "agent_done", id: ag.id, name: `${ag.name} (Fallback)`, index: i, total });
      appendLog({ level: "success", agentId: ag.id, provider: "fallback", message: `✓ [AGENT-${ag.id}] ${ag.name} → done (fallback)` });
    }
  }

  // ===== PHASE 5.5: Output Normalizer + Consistency Checker =====
  appendLog({ level: "info", agentId: "NORMALIZER", provider: "pipeline", message: `▶ [NORMALIZER] Standardizing output...` });
  for (const [, value] of Object.entries(results)) {
    if (!value || typeof value !== "object") continue;
    const data = value as unknown as Record<string, unknown>;
    for (const [field, val] of Object.entries(data)) {
      if (typeof val === "string") data[field] = val.trim().replace(/\0/g, "").replace(/\s{3,}/g, " ");
      if (Array.isArray(val)) {
        const seen = new Set<string>();
        data[field] = val.filter((item) => { const k = JSON.stringify(item); if (seen.has(k)) return false; seen.add(k); return true; });
      }
    }
  }
  const analysisModules = (results.analysis?.modules || []) as string[];
  const designTables = (results.design?.dbTables || []).map((t) => t.name);
  const hrAssignees = (results.hr?.assignments || []).map((a) => a.name);
  const inputMembers = input.members.map((m) => m.name.toLowerCase());
  const inconsistencies: string[] = [];
  for (const assignee of hrAssignees) {
    if (!inputMembers.includes(assignee.toLowerCase())) inconsistencies.push(`HR assigns "${assignee}" but no such member`);
  }
  if (inconsistencies.length > 0) {
    appendLog({ level: "warn", agentId: "NORMALIZER", provider: "pipeline", message: `⚠ [CONSISTENCY] ${inconsistencies.length} issue(s): ${inconsistencies.slice(0, 3).join("; ")}` });
  } else {
    appendLog({ level: "success", agentId: "NORMALIZER", provider: "pipeline", message: `✓ [NORMALIZER] All sections normalized + consistency OK` });
  }

  // ===== PHASE 6: Quality Reviewer =====
  onProgress?.({ type: "agent_start", id: "10", name: "Quality Reviewer", index: 9, total });
  appendLog({ level: "info", agentId: "10", provider: "pipeline", message: `[AGENT-10] Quality Reviewer → start` });

  try {
    const summary = buildReviewSummary(results as ProjectResult, input.topic);
    const res = await callAndParse(
      REVIEWER_MODELS,
      PROMPT_MAP.security() + `\n\nBan la Quality Reviewer. Kiem tra dong bo toan bo ket qua.\n${JSON_INSTRUCTION}`,
      `${summary}\n\nTra lai object voi cung cau truc, chi sua nhung gi can sua.`,
      0.1, undefined
    );
    if (res && res.data) {
      const rev = res.data as ProjectResult;
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      onProgress?.({ type: "agent_done", id: "10", name: "Quality Reviewer", index: 9, total });
      appendLog({ level: "success", agentId: "10", provider: "pipeline", model: res.model, message: `✓ [AGENT-10] Reviewer → done (${res.model}, ${sec}s total)` });
      appendLog({ level: "info", agentId: "PIPELINE", provider: "pipeline", message: `📊 [METRICS] Pipeline: ${sec}s | ${Object.keys(rev).length}/9 sections | ${((AGENTS.length - failed.length) / AGENTS.length * 100).toFixed(0)}% success` });
      return rev;
    }
  } catch (e) {
    appendLog({ level: "error", agentId: "10", provider: "pipeline", message: `✗ [AGENT-10] Reviewer → ${(e as Error).message?.substring(0, 100)}` });
  }

  // Fallback: return original results
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  onProgress?.({ type: "agent_fail", id: "10", name: "Quality Reviewer", index: 9, total });
  appendLog({ level: "info", agentId: "PIPELINE", provider: "pipeline", message: `📊 [METRICS] Pipeline: ${sec}s | ${Object.keys(results).length}/9 sections | ${((AGENTS.length - failed.length) / AGENTS.length * 100).toFixed(0)}% success | ${failed.length} failed` });

  // Per-model health stats
  const allModelsUsed = new Set<string>();
  for (const ag of AGENTS) ag.models.forEach(m => allModelsUsed.add(m));
  for (const m of allModelsUsed) {
    const h = getModelHealth(m);
    if (h.totalCalls > 0) {
      appendLog({ level: h.successRate >= 0.8 ? "success" : h.successRate >= 0.5 ? "warn" : "error", agentId: "METRICS", provider: "openrouter", model: m, message: `📊 ${m}: ${(h.successRate * 100).toFixed(0)}% success (${h.totalCalls} calls)` });
    }
  }

  appendLog({ level: "warn", agentId: "10", provider: "pipeline", message: `▷ [AGENT-10] Reviewer → returning original results (${sec}s)` });
  return results as ProjectResult;
}
