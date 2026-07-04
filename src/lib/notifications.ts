// NEXUS AI - Notification helper
// Centralized function to create a notification AND broadcast it in realtime
// via the notification WebSocket service. Every part of the app that triggers
// a notification (task status change, proposal created, mail sent, etc.) should
// call `createNotification()` here so the DB write + WS broadcast stay in sync.

import { db } from "./db";

export type NotificationType =
  | "TASK_COMPLETED"
  | "TASK_STATUS_CHANGED"
  | "PROPOSAL_CREATED"
  | "REQUIREMENT_EDITED"
  | "DOC_UPLOADED"
  | "COMMENT"
  | "AI_DONE"
  | "AI_ERROR"
  | "DEADLINE_SOON"
  | "TASK_ASSIGNED"
  | "MAIL_RECEIVED"
  | "PROJECT_INVITE"
  | "APPROVAL_REQUEST"
  | "ACTIVITY";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface CreateNotificationArgs {
  projectId: string;
  type: NotificationType;
  title: string;
  message?: string;
  senderName?: string;
  senderRole?: string;
  recipientEmail?: string | null; // null/undefined = broadcast to whole project
  priority?: NotificationPriority;
  relatedTaskId?: string | null;
  relatedTaskTitle?: string;
  relatedMailId?: string | null;
  actionUrl?: string;
  actionLabel?: string;
  extra?: Record<string, unknown>;
}

/**
 * The port the notification WebSocket mini-service listens on.
 * Must match mini-services/notification-service/index.ts
 */
export const NOTIFICATION_SERVICE_PORT = 3002;

/**
 * Create a notification in the DB and broadcast it in realtime via the
 * notification WebSocket service. Safe to call from any server context
 * (API routes, pipeline, etc.). The WS broadcast is fire-and-forget —
 * if the service is down the notification is still stored.
 */
export async function createNotification(
  args: CreateNotificationArgs
) {
  // 1. Persist
  const notif = await db.notification.create({
    data: {
      projectId: args.projectId,
      type: args.type,
      title: args.title,
      message: args.message || "",
      senderName: args.senderName || "",
      senderRole: args.senderRole || "",
      recipientEmail: args.recipientEmail ?? null,
      priority: args.priority || "normal",
      relatedTaskId: args.relatedTaskId ?? null,
      relatedTaskTitle: args.relatedTaskTitle || "",
      relatedMailId: args.relatedMailId ?? null,
      actionUrl: args.actionUrl || "",
      actionLabel: args.actionLabel || "",
      extra: args.extra ? JSON.stringify(args.extra) : "{}",
    },
  });

  // 2. Broadcast (fire-and-forget)
  try {
    await fetch(
      `http://localhost:${NOTIFICATION_SERVICE_PORT}/broadcast`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: args.projectId,
          recipientEmail: args.recipientEmail ?? null,
          notification: {
            id: notif.id,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            senderName: notif.senderName,
            senderRole: notif.senderRole,
            priority: notif.priority,
            relatedTaskTitle: notif.relatedTaskTitle,
            actionUrl: notif.actionUrl,
            actionLabel: notif.actionLabel,
            createdAt: notif.createdAt.toISOString(),
          },
        }),
        signal: AbortSignal.timeout(3000),
      }
    );
  } catch {
    // WS service down — notification is still stored. Client will pick it up on next poll.
  }

  return notif;
}

/**
 * Compute the unread notification count for a user (leader or member).
 * A notification is "for" a user when recipientEmail is null (broadcast)
 * or equals the user's email. It's "unread" when no NotificationRead row exists.
 */
export async function getUnreadCount(
  projectId: string,
  userEmail: string
): Promise<number> {
  const candidates = await db.notification.findMany({
    where: {
      projectId,
      OR: [{ recipientEmail: null }, { recipientEmail: userEmail }],
    },
    select: { id: true },
  });
  if (candidates.length === 0) return 0;
  const readIds = await db.notificationRead.findMany({
    where: {
      readerEmail: userEmail,
      notificationId: { in: candidates.map((c) => c.id) },
    },
    select: { notificationId: true },
  });
  const readSet = new Set(readIds.map((r) => r.notificationId));
  return candidates.filter((c) => !readSet.has(c.id)).length;
}
