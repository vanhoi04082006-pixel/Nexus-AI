// ai/contracts/registry.ts — Plugin Registry
// Auto-discovers and registers all agent plugins.
// Agents are registered via registerAgent() and looked up by id or key.

import type { AgentContract, AgentManifest } from "./agent";

/**
 * The Plugin Registry — stores all registered agents.
 * Agents can be registered programmatically or loaded from plugins/ folder.
 */
class AgentRegistry {
  private agents = new Map<string, AgentContract>();
  private byKey = new Map<string, AgentContract[]>();

  /** Register an agent contract */
  register(contract: AgentContract): void {
    const { id, key } = contract.manifest;
    if (this.agents.has(id)) {
      console.warn(`[REGISTRY] Agent "${id}" already registered — overwriting`);
    }
    this.agents.set(id, contract);

    // Also index by section key (multiple agents can produce same key)
    if (!this.byKey.has(key)) this.byKey.set(key, []);
    this.byKey.get(key)!.push(contract);

    console.log(`[REGISTRY] Registered agent "${id}" (${contract.manifest.name}) — key: ${key}, deps: [${contract.manifest.dependencies.join(", ")}]`);
  }

  /** Get agent by ID */
  getById(id: string): AgentContract | undefined {
    return this.agents.get(id);
  }

  /** Get all agents that produce a given section key */
  getByKey(key: string): AgentContract[] {
    return this.byKey.get(key) || [];
  }

  /** Get all registered agents */
  getAll(): AgentContract[] {
    return Array.from(this.agents.values());
  }

  /** Get all manifests (for DAG construction) */
  getManifests(): AgentManifest[] {
    return this.getAll().map((a) => a.manifest);
  }

  /** Get agents sorted by priority (higher first) */
  getSorted(): AgentContract[] {
    return this.getAll().sort((a, b) => b.manifest.priority - a.manifest.priority);
  }

  /** Check if an agent is registered */
  has(id: string): boolean {
    return this.agents.has(id);
  }

  /** Unregister an agent */
  unregister(id: string): void {
    const agent = this.agents.get(id);
    if (agent) {
      const key = agent.manifest.key;
      this.agents.delete(id);
      const keyAgents = this.byKey.get(key);
      if (keyAgents) {
        const idx = keyAgents.indexOf(agent);
        if (idx >= 0) keyAgents.splice(idx, 1);
        if (keyAgents.length === 0) this.byKey.delete(key);
      }
    }
  }

  /** Clear all registered agents */
  clear(): void {
    this.agents.clear();
    this.byKey.clear();
  }
}

/** Singleton registry instance */
export const registry = new AgentRegistry();
