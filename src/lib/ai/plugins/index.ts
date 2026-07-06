// ai/plugins/ — Agent Plugin Definitions
// Each plugin is a self-contained module that registers itself with the
// Plugin Registry. To add a new agent, create a new file here and call
// registry.register().
//
// Plugin structure:
//   plugins/
//   ├── planner.ts          — Phase 0: decompose topic into modules
//   ├── analyst.ts          — Phase 1: requirement analysis
//   ├── hr.ts               — Phase 1: HR planning
//   ├── sprint.ts           — Phase 1: sprint planning
//   ├── architect.ts        — Phase 2: system architecture
//   ├── uml.ts              — Phase 2: UML diagrams
//   ├── docs.ts             — Phase 2: documentation
//   ├── git.ts              — Phase 2: git/devops
//   ├── tester.ts           — Phase 3: test planning
//   ├── security.ts         — Phase 3: security review
//   ├── business-analyst.ts — NEW: business analysis
//   ├── database-designer.ts — NEW: DB design
//   ├── api-designer.ts     — NEW: API design
//   ├── ui-ux.ts            — NEW: UI/UX design
//   └── index.ts            — auto-registers all plugins

import { registry } from "../contracts/registry";
import { createAgent, type AgentManifest } from "../contracts/agent";
import { validateSection } from "@/lib/schemas";
import { callAndParse } from "../pipeline/runner";
import { AGENTS } from "../agents/definitions";
import { PROMPT_MAP, TASK_GEN_PROMPT } from "../prompts";
import { fallback } from "../pipeline/fallback";
import type { SectionType } from "@/lib/types";

// ===== Helper: convert existing AgentDef to AgentContract =====
function registerExistingAgent(agentDef: typeof AGENTS[0]): void {
  const manifest: AgentManifest = {
    id: agentDef.id,
    name: agentDef.name,
    version: "2.0.0",
    key: agentDef.key,
    dependencies: getDependencies(agentDef.key),
    required: agentDef.required,
    temperature: agentDef.temp,
    models: agentDef.models,
    priority: 100 - parseInt(agentDef.id, 10), // lower id = higher priority
    description: `${agentDef.name} — generates ${agentDef.key} section`,
  };

  registry.register(
    createAgent(
      manifest,
      async (input) => {
        const res = await callAndParse(
          agentDef.models,
          PROMPT_MAP[agentDef.key](),
          input.context,
          agentDef.temp,
          agentDef.key
        );
        if (res) {
          return { success: true, data: res.data, model: res.model };
        }
        return { success: false, data: null, model: "", error: "All models failed" };
      },
      (data) => {
        const result = validateSection(agentDef.key, data);
        return result.success ? { valid: true } : { valid: false, errors: [result.error] };
      },
      (input) => fallback(agentDef.key, input.projectInput as never, input.results as never)
    )
  );
}

// ===== Dependency graph (mirrors dag.ts) =====
function getDependencies(key: string): string[] {
  const deps: Record<string, string[]> = {
    analysis: [],
    hr: ["analysis"],
    sprint: ["analysis", "hr"],
    design: ["analysis"],
    uml: ["design"],
    docs: ["design"],
    git: ["analysis"],
    test: ["design"],
    security: ["design"],
  };
  return deps[key] || [];
}

// ===== Register all existing agents =====
export function registerAllPlugins(): void {
  for (const agent of AGENTS) {
    registerExistingAgent(agent);
  }

  // Register NEW agents (Phase 4 — expansion toward 45 agents)

  // Planner Agent (already exists in pipeline, register as plugin too)
  registry.register(
    createAgent(
      {
        id: "planner",
        name: "Planner Agent",
        version: "1.0.0",
        key: "planning",
        dependencies: [],
        required: false,
        temperature: 0.2,
        models: ["openai/gpt-oss-120b:free", "nvidia/nemotron-3-super-120b-a12b:free", "google/gemma-4-31b-it:free"],
        priority: 200, // highest priority — runs first
        description: "Decomposes topic into modules before Analysis",
      },
      async (input) => {
        const res = await callAndParse(
          ["openai/gpt-oss-120b:free", "nvidia/nemotron-3-super-120b-a12b:free", "google/gemma-4-31b-it:free"],
          `Ban la Project Planner. Chia nho chu de du an thanh modules.`,
          `Du an: ${(input.projectInput as { topic?: string })?.topic || ""}`,
          0.2,
          undefined
        );
        if (res) return { success: true, data: res.data, model: res.model };
        return { success: false, data: null, model: "", error: "Planner failed" };
      },
      () => ({ valid: true }),
      () => ({ modules: ["Core"] })
    )
  );

  // Business Analyst Agent
  registry.register(
    createAgent(
      {
        id: "business-analyst",
        name: "Business Analyst",
        version: "1.0.0",
        key: "analysis",
        dependencies: [],
        required: false,
        temperature: 0.25,
        models: ["google/gemma-4-31b-it:free", "nvidia/nemotron-3-ultra-550b-a55b:free", "openai/gpt-oss-120b:free"],
        priority: 95,
        description: "Analyzes business rules and domain logic separately from requirements",
      },
      async (input) => {
        const res = await callAndParse(
          ["google/gemma-4-31b-it:free", "nvidia/nemotron-3-ultra-550b-a55b:free", "openai/gpt-oss-120b:free"],
          `Ban la Business Analyst. Phan tich nghiep vu cua du an — business rules, domain logic, workflows.`,
          input.context,
          0.25,
          "analysis"
        );
        if (res) return { success: true, data: res.data, model: res.model };
        return { success: false, data: null, model: "", error: "Business Analyst failed" };
      },
      (data) => {
        const result = validateSection("analysis", data);
        return result.success ? { valid: true } : { valid: false, errors: [result.error] };
      },
      (input) => fallback("analysis", input.projectInput as never, input.results as never)
    )
  );

  // Database Designer Agent
  registry.register(
    createAgent(
      {
        id: "database-designer",
        name: "Database Designer",
        version: "1.0.0",
        key: "design",
        dependencies: ["analysis"],
        required: false,
        temperature: 0.15,
        models: ["openai/gpt-oss-120b:free", "qwen/qwen3-coder:free", "nvidia/nemotron-3-ultra-550b-a55b:free"],
        priority: 90,
        description: "Specialized database schema designer — focuses only on DB tables, indexes, relations",
      },
      async (input) => {
        const res = await callAndParse(
          ["openai/gpt-oss-120b:free", "qwen/qwen3-coder:free", "nvidia/nemotron-3-ultra-550b-a55b:free"],
          `Ban la Database Designer. Chi thiet ke database schema — tables, columns, indexes, relations, constraints.
          Phu hop voi modules: ${(input.results?.analysis as { modules?: string[] })?.modules?.join(", ") || "Core"}`,
          input.context,
          0.15,
          "design"
        );
        if (res) return { success: true, data: res.data, model: res.model };
        return { success: false, data: null, model: "", error: "Database Designer failed" };
      },
      (data) => {
        const result = validateSection("design", data);
        return result.success ? { valid: true } : { valid: false, errors: [result.error] };
      },
      (input) => fallback("design", input.projectInput as never, input.results as never)
    )
  );

  // API Designer Agent
  registry.register(
    createAgent(
      {
        id: "api-designer",
        name: "API Designer",
        version: "1.0.0",
        key: "design",
        dependencies: ["analysis"],
        required: false,
        temperature: 0.15,
        models: ["openai/gpt-oss-120b:free", "qwen/qwen3-coder:free", "google/gemma-4-31b-it:free"],
        priority: 88,
        description: "Specialized API designer — REST/GraphQL endpoints, request/response schemas",
      },
      async (input) => {
        const res = await callAndParse(
          ["openai/gpt-oss-120b:free", "qwen/qwen3-coder:free", "google/gemma-4-31b-it:free"],
          `Ban la API Designer. Chi thiet ke API endpoints — REST, request/response, status codes, pagination.`,
          input.context,
          0.15,
          "design"
        );
        if (res) return { success: true, data: res.data, model: res.model };
        return { success: false, data: null, model: "", error: "API Designer failed" };
      },
      (data) => {
        const result = validateSection("design", data);
        return result.success ? { valid: true } : { valid: false, errors: [result.error] };
      },
      (input) => fallback("design", input.projectInput as never, input.results as never)
    )
  );

  // UI/UX Designer Agent
  registry.register(
    createAgent(
      {
        id: "ui-ux-designer",
        name: "UI/UX Designer",
        version: "1.0.0",
        key: "docs",
        dependencies: ["analysis"],
        required: false,
        temperature: 0.30,
        models: ["google/gemma-4-31b-it:free", "openai/gpt-oss-120b:free", "nvidia/nemotron-3-super-120b-a12b:free"],
        priority: 85,
        description: "UI/UX designer — wireframes, screen flows, user journeys, accessibility",
      },
      async (input) => {
        const res = await callAndParse(
          ["google/gemma-4-31b-it:free", "openai/gpt-oss-120b:free", "nvidia/nemotron-3-super-120b-a12b:free"],
          `Ban la UI/UX Designer. Thiet ke wireframes, screen flows, user journeys, accessibility guidelines.`,
          input.context,
          0.30,
          "docs"
        );
        if (res) return { success: true, data: res.data, model: res.model };
        return { success: false, data: null, model: "", error: "UI/UX Designer failed" };
      },
      (data) => {
        const result = validateSection("docs", data);
        return result.success ? { valid: true } : { valid: false, errors: [result.error] };
      },
      (input) => fallback("docs", input.projectInput as never, input.results as never)
    )
  );

  console.log(`[PLUGINS] Registered ${registry.getAll().length} agents (10 core + 5 new)`);
}
