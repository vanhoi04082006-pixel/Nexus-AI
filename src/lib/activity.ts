// NEXUS AI - Activity logging + system status helpers
// Centralized so every event source (project CRUD, task changes, mail, proposals,
// pipeline, AI agents) writes a consistent ActivityLog row + broadcasts a realtime
// event via the notification-service WebSocket.

import { db } from "./db";
import { NOTIFICATION_SERVICE_PORT } from "./notifications";

export type ActivityType =
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "PROJECT_DELETED"
  | "MEMBER_JOINED"
  | "MEMBER_LEFT"
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_STATUS_CHANGED"
  | "TASK_COMPLETED"
  | "DOC_UPLOADED"
  | "AI_AGENT_START"
  | "AI_AGENT_DONE"
  | "AI_AGENT_ERROR"
  | "SPRINT_CREATED"
  | "DEPLOY"
  | "GIT_MERGE"
  | "PROPOSAL_CREATED"
  | "PROPOSAL_APPROVED"
  | "PROPOSAL_REJECTED"
  | "MAIL_SENT"
  | "MAIL_RECEIVED"
  | "PIPELINE"
  | "INIT"
  | "REFINE"
  | "TASK_GEN"
  | "SECTION_EDIT"
  | "GITHUB_PUSH"
  | "EMAIL_SENT";

export interface LogActivityArgs {
  projectId: string;
  type: ActivityType;
  title: string;
  details?: string;
  status?: "SUCCESS" | "FAILED" | "RUNNING" | "WARNING";
  actorName?: string;
  actorEmail?: string;
  actorRole?: string; // Leader | Member | AI Agent | System
  actorAvatar?: string;
  relatedTaskId?: string | null;
  relatedTaskTitle?: string;
  relatedMailId?: string | null;
  actionUrl?: string;
  actionLabel?: string;
  icon?: string; // lucide icon name
  // legacy fields
  agentId?: string | null;
  model?: string | null;
  duration?: number | null;
  logCount?: number | null;
}

// Map activity type → default lucide icon name
const ICON_BY_TYPE: Record<string, string> = {
  PROJECT_CREATED: "FolderPlus",
  PROJECT_UPDATED: "FolderEdit",
  PROJECT_DELETED: "Trash2",
  MEMBER_JOINED: "UserPlus",
  MEMBER_LEFT: "UserMinus",
  TASK_CREATED: "ListPlus",
  TASK_UPDATED: "ListChecks",
  TASK_STATUS_CHANGED: "RefreshCw",
  TASK_COMPLETED: "CheckCircle2",
  DOC_UPLOADED: "Upload",
  AI_AGENT_START: "Bot",
  AI_AGENT_DONE: "Bot",
  AI_AGENT_ERROR: "AlertCircle",
  SPRINT_CREATED: "CalendarPlus",
  DEPLOY: "Rocket",
  GIT_MERGE: "GitMerge",
  PROPOSAL_CREATED: "FileEdit",
  PROPOSAL_APPROVED: "Check",
  PROPOSAL_REJECTED: "X",
  MAIL_SENT: "Send",
  MAIL_RECEIVED: "Mail",
  PIPELINE: "Cpu",
  INIT: "Rocket",
  REFINE: "RefreshCw",
  TASK_GEN: "ListTodo",
  SECTION_EDIT: "FileEdit",
  GITHUB_PUSH: "Github",
  EMAIL_SENT: "Send",
};

/**
 * Write an ActivityLog row and broadcast a `activity:new` event via the
 * notification-service WebSocket so dashboards refresh in realtime.
 */
export async function logActivity(args: LogActivityArgs) {
  const icon = args.icon || ICON_BY_TYPE[args.type] || "Activity";

  const log = await db.activityLog.create({
    data: {
      projectId: args.projectId,
      type: args.type,
      title: args.title,
      details: args.details || "",
      status: args.status || "SUCCESS",
      actorName: args.actorName || "",
      actorEmail: args.actorEmail || "",
      actorRole: args.actorRole || "",
      actorAvatar: args.actorAvatar || "",
      relatedTaskId: args.relatedTaskId ?? null,
      relatedTaskTitle: args.relatedTaskTitle || "",
      relatedMailId: args.relatedMailId ?? null,
      actionUrl: args.actionUrl || "",
      actionLabel: args.actionLabel || "",
      icon,
      agentId: args.agentId ?? null,
      model: args.model ?? null,
      duration: args.duration ?? null,
      logCount: args.logCount ?? null,
    },
  });

  // Broadcast realtime event (fire-and-forget)
  try {
    await fetch(`http://localhost:${NOTIFICATION_SERVICE_PORT}/broadcast-activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: args.projectId,
        activity: {
          id: log.id,
          type: log.type,
          title: log.title,
          details: log.details,
          actorName: log.actorName,
          actorRole: log.actorRole,
          icon: log.icon,
          relatedTaskTitle: log.relatedTaskTitle,
          actionUrl: log.actionUrl,
          createdAt: log.createdAt.toISOString(),
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // WS service down — log still stored; client will pick up on next poll.
  }

  return log;
}

/**
 * Update or insert an AgentStatus row (live agent state).
 * status: online | offline | busy | error | idle
 */
export async function updateAgentStatus(
  agentId: string,
  name: string,
  role: string,
  status: "online" | "offline" | "busy" | "error" | "idle",
  currentTask = "",
  projectId?: string
) {
  await db.agentStatus.upsert({
    where: { agentId },
    update: {
      name,
      role,
      status,
      currentTask,
      projectId: projectId || null,
      lastActiveAt: new Date(),
    },
    create: {
      agentId,
      name,
      role,
      status,
      currentTask,
      projectId: projectId || null,
      lastActiveAt: new Date(),
    },
  });
}

/**
 * Update a SystemStatus row (database / redis / vector_db / storage / pipeline).
 */
export async function updateSystemStatus(
  subsystem: "database" | "redis" | "vector_db" | "storage" | "pipeline",
  status: string,
  details = "",
  metadata: Record<string, unknown> = {}
) {
  await db.systemStatus.upsert({
    where: { subsystem },
    update: { status, details, metadata: JSON.stringify(metadata) },
    create: { subsystem, status, details, metadata: JSON.stringify(metadata) },
  });
}

/**
 * Update PipelineStatus for a project.
 */
export async function updatePipelineStatus(
  projectId: string,
  status: "ready" | "running" | "paused" | "failed" | "deploying" | "success",
  currentAgent = "",
  progress = 0,
  stage = "",
  error?: string | null
) {
  const existing = await db.pipelineStatus.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  if (existing && (existing.status === "running" || existing.status === "deploying") && status !== "failed") {
    // Update the running row
    await db.pipelineStatus.update({
      where: { id: existing.id },
      data: {
        status,
        currentAgent,
        progress,
        stage,
        error: error ?? null,
        finishedAt: status === "success" || status === "ready" ? new Date() : null,
      },
    });
  } else {
    await db.pipelineStatus.create({
      data: {
        projectId,
        status,
        currentAgent,
        progress,
        stage,
        error: error ?? null,
        startedAt: status === "running" || status === "deploying" ? new Date() : null,
        finishedAt: status === "success" || status === "failed" || status === "ready" ? new Date() : null,
      },
    });
  }
}

/**
 * Refresh the TaskStatistic snapshot for a project (call on any task change).
 */
export async function refreshTaskStatistics(projectId: string) {
  const tasks = await db.task.findMany({
    where: { projectId },
    select: { status: true, deadline: true },
  });
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const stats = {
    totalTasks: tasks.length,
    doneTasks: tasks.filter((t) => t.status === "done").length,
    inProgressTasks: tasks.filter((t) => t.status === "in_progress").length,
    todoTasks: tasks.filter((t) => t.status === "todo").length,
    reviewTasks: tasks.filter((t) => t.status === "review").length,
    overdueTasks: tasks.filter((t) => t.deadline && new Date(t.deadline) < now && t.status !== "done").length,
    dueSoonTasks: tasks.filter(
      (t) => t.deadline && new Date(t.deadline) >= now && new Date(t.deadline) <= in24h && t.status !== "done"
    ).length,
  };
  const completionRate = stats.totalTasks > 0 ? (stats.doneTasks / stats.totalTasks) * 100 : 0;
  await db.taskStatistic.upsert({
    where: { projectId },
    update: { ...stats, completionRate },
    create: { projectId, ...stats, completionRate },
  });
  return stats;
}
