// ai/contracts/agent.ts — Agent Contract Interface
// Every agent in Nexus AI must implement this interface.
// This enables Plugin System — any folder with manifest.json + executor
// that implements this contract is automatically recognized.

import type { SectionType } from "@/lib/types";

/**
 * Input schema for an agent — what it needs to run.
 */
export interface AgentInput {
  projectInput: unknown;
  results: Record<string, unknown>;
  context: string;
}

/**
 * Output schema for an agent — what it returns after running.
 */
export interface AgentOutput {
  success: boolean;
  data: unknown;
  model: string;
  error?: string;
  warnings?: string[];
}

/**
 * Agent Manifest — declares the agent's identity and dependencies.
 */
export interface AgentManifest {
  id: string;
  name: string;
  version: string;
  key: SectionType | string;
  dependencies: string[];
  required: boolean;
  temperature: number;
  models: string[];
  priority: number;
  description: string;
}

/**
 * The Agent Contract — every agent plugin must implement this.
 */
export interface AgentContract {
  manifest: AgentManifest;
  execute(input: AgentInput): Promise<AgentOutput>;
  validate(data: unknown): { valid: boolean; errors?: string[] };
  fallback(input: AgentInput): unknown;
}

/**
 * Factory: create an AgentContract from manifest + functions.
 */
export function createAgent(
  manifest: AgentManifest,
  executor: (input: AgentInput) => Promise<AgentOutput>,
  validator: (data: unknown) => { valid: boolean; errors?: string[] },
  fallbackFn: (input: AgentInput) => unknown
): AgentContract {
  return {
    manifest,
    execute: executor,
    validate: validator,
    fallback: fallbackFn,
  };
}
