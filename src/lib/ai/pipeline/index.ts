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
import {
  PROMPT_MAP,
  umlUseCasePrompt, umlClassErdPrompt, umlSequencePrompt,
  docReadmePrompt, docConventionPrompt, docApiStandardPrompt,
  designDbPrompt, designApiPrompt, designArchPrompt,
  reviewerPrompt,
} from "../prompts";
import { buildCtx, buildReviewSummary, isValidSchema, VALID_SECTION_KEYS } from "../utils/helpers";
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

    // ===== SPLIT AGENTS: design, uml, docs — tách thành nhiều call nhỏ (Single Responsibility) =====
    if (ag.key === "design") {
      return runSplitDesign(ag, ctx, i);
    }
    if (ag.key === "uml") {
      return runSplitUML(ag, ctx, i);
    }
    if (ag.key === "docs") {
      return runSplitDocs(ag, ctx, i);
    }

    // ===== NORMAL AGENTS =====
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

  // ===== SPLIT DESIGN: 3 calls → merge into { architectureDesc, dbTables, apiEndpoints, folderStructure } =====
  async function runSplitDesign(ag: AgentDef, ctx: string, i: number) {
    appendLog({ level: "info", agentId: ag.id, provider: "pipeline", message: `📋 [AGENT-${ag.id}] Splitting Design into 3 sub-tasks (DB, API, Architecture)` });
    try {
      // FIX: sectionKey = undefined → skip Zod (sub-task returns partial, validation after merge)
      const [dbRes, apiRes, archRes] = await Promise.all([
        callAndParse(ag.models, designDbPrompt(), ctx, ag.temp, undefined),
        callAndParse(ag.models, designApiPrompt(), ctx, ag.temp, undefined),
        callAndParse(ag.models, designArchPrompt(), ctx, ag.temp, undefined),
      ]);
      const merged: Record<string, unknown> = {};
      // Sub-task validation: check each result has expected key before merge
      if (dbRes?.data && (dbRes.data as Record<string, unknown>).dbTables) {
        Object.assign(merged, dbRes.data);
        appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model: dbRes.model, message: `  ✓ Design DB: ${((dbRes.data as Record<string, unknown>).dbTables as unknown[])?.length || 0} tables` });
      } else {
        appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", message: `  ⚠ Design DB sub-task failed — using fallback` });
      }
      if (apiRes?.data && (apiRes.data as Record<string, unknown>).apiEndpoints) {
        Object.assign(merged, apiRes.data);
        appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model: apiRes.model, message: `  ✓ Design API: ${((apiRes.data as Record<string, unknown>).apiEndpoints as unknown[])?.length || 0} endpoints` });
      } else {
        appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", message: `  ⚠ Design API sub-task failed — using fallback` });
      }
      if (archRes?.data && ((archRes.data as Record<string, unknown>).folderStructure || (archRes.data as Record<string, unknown>).architectureDesc)) {
        Object.assign(merged, archRes.data);
        appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model: archRes.model, message: `  ✓ Design Architecture: ${((archRes.data as Record<string, unknown>).folderStructure as string)?.length || 0} chars` });
      } else {
        appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", message: `  ⚠ Design Architecture sub-task failed — using fallback` });
      }
      // Ensure all required fields exist (fallback for failed sub-tasks)
      if (!merged.dbTables) merged.dbTables = [];
      if (!merged.apiEndpoints) merged.apiEndpoints = [];
      if (!merged.folderStructure) merged.folderStructure = "";
      if (!merged.architectureDesc) merged.architectureDesc = "";
      (results as Record<string, unknown>)["design"] = merged;
      onProgress?.({ type: "agent_done", id: ag.id, name: ag.name, index: i, total });
      const model = dbRes?.model || apiRes?.model || archRes?.model || "unknown";
      appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model, message: `✓ [AGENT-${ag.id}] Design → done (3 sub-tasks merged, ${model})` });
      return { ag, res: { data: merged, model }, failed: false };
    } catch (err) {
      appendLog({ level: "error", agentId: ag.id, provider: "pipeline", message: `✗ [AGENT-${ag.id}] Design split failed: ${(err as Error).message}` });
      onProgress?.({ type: "agent_fail", id: ag.id, name: ag.name, index: i, total });
      return { ag, res: null, failed: true };
    }
  }

  // ===== SPLIT UML: 3 calls → merge into { useCase, classDiagram, erd, sequence } =====
  async function runSplitUML(ag: AgentDef, ctx: string, i: number) {
    appendLog({ level: "info", agentId: ag.id, provider: "pipeline", message: `📋 [AGENT-${ag.id}] Splitting UML into 3 sub-tasks (UseCase, Class+ERD, Sequence)` });
    try {
      // FIX: sectionKey = undefined → skip Zod (sub-task returns partial, validation after merge)
      const [ucRes, ceRes, seqRes] = await Promise.all([
        callAndParse(ag.models, umlUseCasePrompt(), ctx, ag.temp, undefined),
        callAndParse(ag.models, umlClassErdPrompt(), ctx, ag.temp, undefined),
        callAndParse(ag.models, umlSequencePrompt(), ctx, ag.temp, undefined),
      ]);
      const merged: Record<string, unknown> = {};
      // Sub-task validation + logging
      if (ucRes?.data && (ucRes.data as Record<string, unknown>).useCase) {
        const uc = (ucRes.data as Record<string, unknown>).useCase as string;
        if (/^(graph|flowchart)\s/i.test(uc.trim())) {
          Object.assign(merged, ucRes.data);
          appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model: ucRes.model, message: `  ✓ UML UseCase: valid graph TD (${uc.length} chars)` });
        } else {
          appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", message: `  ⚠ UML UseCase: invalid syntax — using fallback` });
        }
      } else {
        appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", message: `  ⚠ UML UseCase sub-task failed` });
      }
      if (ceRes?.data) {
        const ce = ceRes.data as Record<string, unknown>;
        const validErd = typeof ce.erd === "string" && /^erDiagram\b/i.test(ce.erd.trim());
        const validClass = typeof ce.classDiagram === "string" && /^classDiagram\b/i.test(ce.classDiagram.trim());
        if (validErd && validClass) {
          Object.assign(merged, ceRes.data);
          appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model: ceRes.model, message: `  ✓ UML Class+ERD: valid (${(ce.erd as string).length} + ${(ce.classDiagram as string).length} chars)` });
        } else {
          appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", message: `  ⚠ UML Class+ERD: invalid syntax (erd:${validErd}, class:${validClass}) — using fallback` });
        }
      } else {
        appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", message: `  ⚠ UML Class+ERD sub-task failed` });
      }
      if (seqRes?.data && (seqRes.data as Record<string, unknown>).sequence) {
        const seq = (seqRes.data as Record<string, unknown>).sequence as string;
        if (/^sequenceDiagram\b/i.test(seq.trim())) {
          Object.assign(merged, seqRes.data);
          appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model: seqRes.model, message: `  ✓ UML Sequence: valid (${seq.length} chars)` });
        } else {
          appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", message: `  ⚠ UML Sequence: invalid syntax — using fallback` });
        }
      } else {
        appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", message: `  ⚠ UML Sequence sub-task failed` });
      }
      // Ensure all 4 diagrams exist (fallback for failed sub-tasks)
      if (!merged.useCase) merged.useCase = "";
      if (!merged.classDiagram) merged.classDiagram = "";
      if (!merged.erd) merged.erd = "";
      if (!merged.sequence) merged.sequence = "";
      (results as Record<string, unknown>)["uml"] = merged;
      onProgress?.({ type: "agent_done", id: ag.id, name: ag.name, index: i, total });
      const model = ucRes?.model || ceRes?.model || seqRes?.model || "unknown";
      appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model, message: `✓ [AGENT-${ag.id}] UML → done (3 sub-tasks merged, ${model})` });
      return { ag, res: { data: merged, model }, failed: false };
    } catch (err) {
      appendLog({ level: "error", agentId: ag.id, provider: "pipeline", message: `✗ [AGENT-${ag.id}] UML split failed: ${(err as Error).message}` });
      onProgress?.({ type: "agent_fail", id: ag.id, name: ag.name, index: i, total });
      return { ag, res: null, failed: true };
    }
  }

  // ===== SPLIT DOCS: 3 calls → merge into { readme, convention, apiStandard } =====
  async function runSplitDocs(ag: AgentDef, ctx: string, i: number) {
    appendLog({ level: "info", agentId: ag.id, provider: "pipeline", message: `📋 [AGENT-${ag.id}] Splitting Docs into 3 sub-tasks (README, Convention, API Standard)` });
    try {
      // FIX: sectionKey = undefined → skip Zod (sub-task returns partial, validation after merge)
      const [readmeRes, convRes, apiRes] = await Promise.all([
        callAndParse(ag.models, docReadmePrompt(), ctx, ag.temp, undefined),
        callAndParse(ag.models, docConventionPrompt(), ctx, ag.temp, undefined),
        callAndParse(ag.models, docApiStandardPrompt(), ctx, ag.temp, undefined),
      ]);
      const merged: Record<string, unknown> = {};
      // Sub-task validation + logging
      if (readmeRes?.data && (readmeRes.data as Record<string, unknown>).readme) {
        const readme = (readmeRes.data as Record<string, unknown>).readme as string;
        Object.assign(merged, readmeRes.data);
        appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model: readmeRes.model, message: `  ✓ Docs README: ${readme.length} chars` });
      } else {
        appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", message: `  ⚠ Docs README sub-task failed` });
      }
      if (convRes?.data && (convRes.data as Record<string, unknown>).convention) {
        const conv = (convRes.data as Record<string, unknown>).convention as string;
        Object.assign(merged, convRes.data);
        appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model: convRes.model, message: `  ✓ Docs Convention: ${conv.length} chars` });
      } else {
        appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", message: `  ⚠ Docs Convention sub-task failed` });
      }
      if (apiRes?.data && (apiRes.data as Record<string, unknown>).apiStandard) {
        const apiStd = (apiRes.data as Record<string, unknown>).apiStandard as string;
        Object.assign(merged, apiRes.data);
        appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model: apiRes.model, message: `  ✓ Docs API Standard: ${apiStd.length} chars` });
      } else {
        appendLog({ level: "warn", agentId: ag.id, provider: "pipeline", message: `  ⚠ Docs API Standard sub-task failed` });
      }
      // Ensure all 3 docs exist (fallback for failed sub-tasks)
      if (!merged.readme) merged.readme = "";
      if (!merged.convention) merged.convention = "";
      if (!merged.apiStandard) merged.apiStandard = "";
      (results as Record<string, unknown>)["docs"] = merged;
      onProgress?.({ type: "agent_done", id: ag.id, name: ag.name, index: i, total });
      const model = readmeRes?.model || convRes?.model || apiRes?.model || "unknown";
      appendLog({ level: "success", agentId: ag.id, provider: "pipeline", model, message: `✓ [AGENT-${ag.id}] Docs → done (3 sub-tasks merged, ${model})` });
      return { ag, res: { data: merged, model }, failed: false };
    } catch (err) {
      appendLog({ level: "error", agentId: ag.id, provider: "pipeline", message: `✗ [AGENT-${ag.id}] Docs split failed: ${(err as Error).message}` });
      onProgress?.({ type: "agent_fail", id: ag.id, name: ag.name, index: i, total });
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
      // FIX: Wrap fallback in try-catch — if it throws, pipeline doesn't crash
      // (previously one bad fallback killed all 9 sections)
      try {
        (results as Record<string, unknown>)[ag.key] = fallback(ag.key, input, results);
        onProgress?.({ type: "agent_done", id: ag.id, name: `${ag.name} (Fallback)`, index: i, total });
        appendLog({ level: "success", agentId: ag.id, provider: "fallback", message: `✓ [AGENT-${ag.id}] ${ag.name} → done (fallback)` });
      } catch (fbErr) {
        appendLog({ level: "error", agentId: ag.id, provider: "fallback", message: `✗ [AGENT-${ag.id}] fallback threw: ${(fbErr as Error).message}` });
        (results as Record<string, unknown>)[ag.key] = {}; // last-resort empty object (UI shows "no data" instead of crash)
        onProgress?.({ type: "agent_done", id: ag.id, name: `${ag.name} (Fallback)`, index: i, total });
      }
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
  // FIX: Removed dead variables `analysisModules`, `designTables` (declared but never used)
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
    // FIX: Gửi FULL results (compressed) thay vì chỉ summary — Reviewer cần data thật để review/sửa.
    // Summary chỉ có boolean flags (hasDesc, featuresCount...) → Reviewer không có gì để sửa.
    const fullResultsStr = compressContext(JSON.stringify(results), 10000);
    const res = await callAndParse(
      REVIEWER_MODELS,
      reviewerPrompt() + `\n\nIMPORTANT: Tra lai object JSON voi 9 keys: analysis, hr, sprint, design, uml, docs, git, test, security. Moi key phai co day du noi dung nhu input. Chi sua nhung gi can sua, giu nguyen phan con lai.`,
      `Du an: ${input.topic}\n\nKET QA DAY DU CUA 9 AGENT (JSON):\n${fullResultsStr}\n\nTra lai object JSON day du voi 9 keys.`,
      0.1, undefined
    );
    if (res && res.data) {
      const rev = res.data as Record<string, unknown>;

      // CRITICAL FIX: Safe merge — Reviewer chỉ nhận summary (không phải full results),
      // nên rev có thể thiếu sections hoặc rỗng. Phải merge với results gốc để KHÔNG MẤT DATA.
      const merged = { ...results } as Record<string, unknown>;
      let mergeCount = 0;
      let keepCount = 0;
      for (const key of Object.keys(results) as SectionType[]) {
        const rv = rev[key];
        // Case 1: Reviewer không trả section này → giữ results gốc
        if (rv == null) {
          keepCount++;
          continue; // merged[key] đã = results[key]
        }
        // Case 2: Reviewer trả section rỗng → giữ results gốc
        if (typeof rv === "object" && rv !== null && Object.keys(rv).length === 0) {
          keepCount++;
          continue;
        }
        // Case 3: Reviewer trả section nhưng schema sai → giữ results gốc
        if (!isValidSchema(rv, key)) {
          merged[key] = results[key]; // explicit
          keepCount++;
          appendLog({ level: "warn", agentId: "10", provider: "pipeline", message: `⚠ [REVIEW] Section "${key}" từ reviewer sai schema → giữ data gốc` });
          continue;
        }
        // Case 4: Reviewer trả section hợp lệ → dùng reviewer's version
        merged[key] = rv;
        mergeCount++;
      }

      // Bổ sung: nếu reviewer trả thêm sections mà results không có (vd test/security)
      // FIX: Filter to VALID_SECTION_KEYS only (was accepting garbage keys)
      for (const key of Object.keys(rev) as SectionType[]) {
        if (!VALID_SECTION_KEYS.has(key)) continue; // skip unknown keys
        if (!merged[key] && rev[key] != null && isValidSchema(rev[key], key)) {
          merged[key] = rev[key];
          mergeCount++;
        }
      }

      appendLog({ level: "info", agentId: "10", provider: "pipeline", message: `📋 [REVIEW] Merge: ${mergeCount} section(s) từ reviewer, ${keepCount} section(s) giữ data gốc` });

      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      onProgress?.({ type: "agent_done", id: "10", name: "Quality Reviewer", index: 9, total });
      appendLog({ level: "success", agentId: "10", provider: "pipeline", model: res.model, message: `✓ [AGENT-10] Reviewer → done (${res.model}, ${sec}s total)` });
      appendLog({ level: "info", agentId: "PIPELINE", provider: "pipeline", message: `📊 [METRICS] Pipeline: ${sec}s | ${Object.keys(merged).length}/9 sections | ${((AGENTS.length - failed.length) / AGENTS.length * 100).toFixed(0)}% success` });
      return merged as unknown as ProjectResult;
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
