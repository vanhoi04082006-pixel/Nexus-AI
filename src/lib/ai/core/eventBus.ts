// ai/core/eventBus.ts — Event Bus (pub/sub between agents)
// Uses Node.js EventEmitter — no Redis needed.

import { EventEmitter } from "events";
import { appendLog } from "@/lib/pipeline-progress";

export type PipelineEvent =
  | "agent:start" | "agent:done" | "agent:fail" | "agent:fallback"
  | "pipeline:start" | "pipeline:done" | "pipeline:fail"
  | "section:saved" | "section:refined" | "task:generated"
  | "review:complete" | "review:consensus" | "planner:done"
  | "normalizer:done" | "model:dead" | "model:recovered"
  | "cache:hit" | "cache:miss" | string;

export interface EventPayload {
  event: PipelineEvent;
  agentId?: string; agentName?: string; section?: string;
  model?: string; projectId?: string; data?: unknown;
  timestamp: string;
}

class EventBus extends EventEmitter {
  constructor() { super(); this.setMaxListeners(50); }

  emitEvent(event: PipelineEvent, payload: Partial<EventPayload> = {}): void {
    const full: EventPayload = { event, ...payload, timestamp: new Date().toISOString() };
    this.emit(event, full);
    this.emit("*", full);
    appendLog({
      level: event.includes("fail") || event.includes("dead") ? "error" : event.includes("done") || event.includes("complete") ? "success" : "info",
      agentId: payload.agentId || "EVENT", provider: "eventbus", model: payload.model,
      message: `[EVENT] ${event}${payload.agentId ? ` agent=${payload.agentId}` : ""}${payload.section ? ` section=${payload.section}` : ""}`,
    });
  }

  onEvent(event: PipelineEvent, handler: (p: EventPayload) => void): void { this.on(event, handler); }
  onAll(handler: (p: EventPayload) => void): void { this.on("*", handler); }
  offEvent(event: PipelineEvent, handler: (p: EventPayload) => void): void { this.off(event, handler); }
}

export const eventBus = new EventBus();
