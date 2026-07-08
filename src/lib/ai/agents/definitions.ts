// ai/agents/definitions.ts — Agent definitions + model lists

import type { SectionType } from "@/lib/types";

export interface AgentDef {
  id: string;
  name: string;
  prompt?: () => string;
  key: SectionType;
  required: boolean;
  temp: number;
  models: string[];
}

export const AGENTS: AgentDef[] = [
  {
    id: "01", name: "Requirement Analyst", key: "analysis", required: true, temp: 0.20,
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b:free", "qwen/qwen3-next-80b-a3b-instruct:free",
      "nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-120b:free",
      "nousresearch/hermes-3-llama-3.1-405b:free", "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free", "meta-llama/llama-3.3-70b-instruct:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
    ],
  },
  {
    id: "02", name: "HR Planner", key: "hr", required: false, temp: 0.25,
    models: [
      "google/gemma-4-31b-it:free", "nvidia/nemotron-3-ultra-550b-a55b:free",
      "qwen/qwen3-next-80b-a3b-instruct:free", "openai/gpt-oss-120b:free",
      "nvidia/nemotron-3-super-120b-a12b:free", "google/gemma-4-26b-a4b-it:free",
    ],
  },
  {
    id: "03", name: "Sprint Planner", key: "sprint", required: false, temp: 0.20,
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b:free", "qwen/qwen3-next-80b-a3b-instruct:free",
      "nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-120b:free",
      "google/gemma-4-31b-it:free", "google/gemma-4-26b-a4b-it:free",
    ],
  },
  {
    id: "04", name: "System Architect", key: "design", required: true, temp: 0.15,
    models: [
      "openai/gpt-oss-120b:free", "nvidia/nemotron-3-ultra-550b-a55b:free",
      "qwen/qwen3-coder:free", "nvidia/nemotron-3-super-120b-a12b:free",
      "google/gemma-4-31b-it:free",
    ],
  },
  {
    id: "05", name: "UML Generator", key: "uml", required: false, temp: 0.10,
    models: [
      "openai/gpt-oss-120b:free", "nvidia/nemotron-3-ultra-550b-a55b:free",
      "qwen/qwen3-coder:free", "google/gemma-4-31b-it:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
    ],
  },
  {
    id: "06", name: "Technical Writer", key: "docs", required: false, temp: 0.35,
    models: [
      "google/gemma-4-31b-it:free", "openai/gpt-oss-120b:free",
      "nvidia/nemotron-3-ultra-550b-a55b:free", "google/gemma-4-26b-a4b-it:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
    ],
  },
  {
    id: "07", name: "Git / DevOps", key: "git", required: false, temp: 0.15,
    models: [
      "cohere/north-mini-code:free", "openai/gpt-oss-120b:free",
      "qwen/qwen3-coder:free", "nvidia/nemotron-3-super-120b-a12b:free",
    ],
  },
  {
    id: "08", name: "Software Tester", key: "test", required: false, temp: 0.20,
    models: [
      "qwen/qwen3-coder:free", "openai/gpt-oss-120b:free",
      "nvidia/nemotron-3-super-120b-a12b:free", "google/gemma-4-31b-it:free",
    ],
  },
  {
    id: "09", name: "Security Reviewer", key: "security", required: false, temp: 0.15,
    models: [
      "openai/gpt-oss-120b:free", "nvidia/nemotron-3-ultra-550b-a55b:free",
      "nvidia/nemotron-3-super-120b-a12b:free", "google/gemma-4-31b-it:free",
    ],
  },
  // NOTE: Agent 10 (Quality Reviewer) is NOT in this array.
  // It runs explicitly in Phase 6 via REVIEWER_MODELS (see pipeline/index.ts).
  // Previously it was here with key:"security" → ran in Phase 3 alongside Agent 09,
  // overwriting Agent 09's output non-deterministically. Removed to fix that bug.
];

export const REVIEWER_MODELS = [
  "openai/gpt-oss-120b:free", "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
];

export const TASK_GEN_MODELS = [
  "openai/gpt-oss-120b:free", "nvidia/nemotron-3-ultra-550b-a55b:free",
  "google/gemma-4-31b-it:free", "qwen/qwen3-coder:free",
];

export const CHAT_MODELS = [
  "openai/gpt-oss-120b:free", "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

export const MIN_KEYS: Record<SectionType, string[]> = {
  analysis: ["desc", "techStack", "features", "actors", "modules"],
  hr: ["assignments"],
  sprint: ["sprints"],
  design: ["dbTables", "apiEndpoints", "folderStructure"],
  uml: ["useCase", "classDiagram", "erd", "sequence"],
  docs: ["readme", "convention", "apiStandard"],
  git: ["gitCommands", "branchStrategy", "issueTemplate", "repoUrl"],
  test: ["testStrategy", "unitTests"],
  security: ["threats", "authFlow"],
};
