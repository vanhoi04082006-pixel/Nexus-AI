// ai/queue/taskQueue.ts — Distributed Queue (in-memory)
// No Redis needed — uses in-memory priority queue with worker pool.
// Supports: priority, retry, backoff, concurrent workers, dead letter queue.

import { appendLog } from "@/lib/pipeline-progress";

export interface QueueTask<T = unknown> {
  id: string;
  type: string;
  priority: number; // higher = more important
  data: T;
  retries: number;
  maxRetries: number;
  createdAt: number;
}

interface QueueOptions {
  maxWorkers?: number;
  retryDelay?: number; // ms
  maxRetries?: number;
}

class TaskQueue<T = unknown> {
  private queue: QueueTask<T>[] = [];
  private processing = new Set<string>();
  private deadLetter: QueueTask<T>[] = [];
  private workers: number;
  private retryDelay: number;
  private maxRetries: number;
  private running = false;
  private handler?: (task: QueueTask<T>) => Promise<void>;

  constructor(opts: QueueOptions = {}) {
    this.workers = opts.maxWorkers || 3;
    this.retryDelay = opts.retryDelay || 5000;
    this.maxRetries = opts.maxRetries || 2;
  }

  /** Register the task handler */
  setHandler(handler: (task: QueueTask<T>) => Promise<void>): void {
    this.handler = handler;
  }

  /** Add a task to the queue */
  enqueue(type: string, data: T, priority = 0): string {
    const task: QueueTask<T> = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type,
      priority,
      data,
      retries: 0,
      maxRetries: this.maxRetries,
      createdAt: Date.now(),
    };
    this.queue.push(task);
    // Sort by priority (higher first), then by creation time (older first)
    this.queue.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
    appendLog({ level: "info", provider: "pipeline", message: `[QUEUE] Enqueued ${task.id} (type: ${type}, priority: ${priority}) — queue size: ${this.queue.length}` });
    this.process();
    return task.id;
  }

  /** Start processing the queue */
  start(): void {
    this.running = true;
    this.process();
  }

  /** Stop processing */
  stop(): void {
    this.running = false;
  }

  /** Process tasks with worker pool */
  private async process(): Promise<void> {
    if (!this.running || !this.handler) return;

    while (this.processing.size < this.workers && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;
      this.processing.add(task.id);

      // Fire and forget — don't await (parallel workers)
      this.executeTask(task).catch((err) => {
        appendLog({ level: "error", provider: "pipeline", message: `[QUEUE] Unhandled error in ${task.id}: ${err instanceof Error ? err.message : "unknown"}` });
      });
    }
  }

  private async executeTask(task: QueueTask<T>): Promise<void> {
    try {
      appendLog({ level: "info", provider: "pipeline", message: `[QUEUE] Processing ${task.id} (worker ${this.processing.size}/${this.workers})` });
      await this.handler!(task);
      this.processing.delete(task.id);
      appendLog({ level: "success", provider: "pipeline", message: `[QUEUE] Completed ${task.id}` });
    } catch (err) {
      this.processing.delete(task.id);
      const errorMsg = err instanceof Error ? err.message : "unknown";

      if (task.retries < task.maxRetries) {
        task.retries++;
        appendLog({ level: "warn", provider: "pipeline", message: `[QUEUE] Retry ${task.retries}/${task.maxRetries} for ${task.id} — ${errorMsg}` });
        // Re-enqueue after delay
        setTimeout(() => {
          this.queue.push(task);
          this.queue.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
          this.process();
        }, this.retryDelay * task.retries); // exponential backoff
      } else {
        this.deadLetter.push(task);
        appendLog({ level: "error", provider: "pipeline", message: `[QUEUE] DEAD LETTER ${task.id} — max retries exceeded (${task.maxRetries})` });
      }
    }

    // Continue processing
    this.process();
  }

  /** Get queue stats */
  stats(): { pending: number; processing: number; deadLetter: number; workers: number } {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      deadLetter: this.deadLetter.length,
      workers: this.workers,
    };
  }

  /** Get dead letter tasks */
  getDeadLetter(): QueueTask<T>[] {
    return [...this.deadLetter];
  }

  /** Retry a dead letter task */
  retryDeadLetter(taskId: string): boolean {
    const idx = this.deadLetter.findIndex((t) => t.id === taskId);
    if (idx === -1) return false;
    const task = this.deadLetter.splice(idx, 1)[0];
    task.retries = 0;
    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);
    this.process();
    appendLog({ level: "info", provider: "pipeline", message: `[QUEUE] Retried dead letter ${taskId}` });
    return true;
  }

  /** Clear all */
  clear(): void {
    this.queue = [];
    this.deadLetter = [];
    this.processing.clear();
  }
}

/** Singleton task queue — 3 workers, 5s retry delay, 2 max retries */
export const taskQueue = new TaskQueue({ maxWorkers: 3, retryDelay: 5000, maxRetries: 2 });
