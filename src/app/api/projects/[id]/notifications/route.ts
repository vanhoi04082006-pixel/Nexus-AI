// NEXUS AI - GET/POST /api/projects/[id]/notifications
// GET: List notifications for a project, scoped to the requesting user (leader/member).
//      A notification belongs to the user when recipientEmail is null (broadcast)
//      OR recipientEmail equals the user's email. Includes per-user read state.
// POST: Create a notification (internal — used by task/proposal/mail flows).
//       Body action "mark_all_read" marks all of the user's notifications as read.

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const access = await resolveAccess(id, token);
  if (!access) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  const userEmail = access.email || access.name;

  // Fetch notifications visible to this user
  const notifications = await db.notification.findMany({
    where: {
      projectId: id,
      OR: [{ recipientEmail: null }, { recipientEmail: userEmail }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      readBy: {
        where: { readerEmail: userEmail },
        select: { id: true, readAt: true },
      },
    },
  });

  // Fetch project topic for the detail panel
  const project = await db.project.findUnique({
    where: { id },
    select: { topic: true },
  });

  const enriched = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    senderName: n.senderName,
    senderRole: n.senderRole,
    recipientEmail: n.recipientEmail,
    priority: n.priority,
    relatedTaskId: n.relatedTaskId,
    relatedTaskTitle: n.relatedTaskTitle,
    relatedMailId: n.relatedMailId,
    actionUrl: n.actionUrl,
    actionLabel: n.actionLabel,
    extra: n.extra,
    createdAt: n.createdAt.toISOString(),
    read: n.readBy.length > 0,
    readAt: n.readBy[0]?.readAt?.toISOString() || null,
    projectTopic: project?.topic || "",
    projectId: n.projectId,
  }));

  const unreadCount = enriched.filter((n) => !n.read).length;

  return Response.json({ notifications: enriched, unreadCount, userEmail });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const access = await resolveAccess(id, token);
  if (!access) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  const userEmail = access.email || access.name;
  const body = (await req.json()) as {
    action?: "mark_all_read" | "create";
    // create fields:
    type?: string;
    title?: string;
    message?: string;
    senderName?: string;
    senderRole?: string;
    recipientEmail?: string | null;
    priority?: string;
    relatedTaskId?: string;
    relatedTaskTitle?: string;
    relatedMailId?: string;
    actionUrl?: string;
    actionLabel?: string;
    extra?: Record<string, unknown>;
  };

  // Mark all read
  if (body.action === "mark_all_read") {
    const candidates = await db.notification.findMany({
      where: {
        projectId: id,
        OR: [{ recipientEmail: null }, { recipientEmail: userEmail }],
      },
      select: { id: true },
    });
    // Insert NotificationRead rows for any not yet read
    const existing = await db.notificationRead.findMany({
      where: {
        readerEmail: userEmail,
        notificationId: { in: candidates.map((c) => c.id) },
      },
      select: { notificationId: true },
    });
    const existingSet = new Set(existing.map((e) => e.notificationId));
    const toMark = candidates.filter((c) => !existingSet.has(c.id));
    if (toMark.length > 0) {
      await db.notificationRead.createMany({
        data: toMark.map((c) => ({
          notificationId: c.id,
          readerEmail: userEmail,
        })),
      });
    }
    return Response.json({ success: true, marked: toMark.length });
  }

  // Create notification
  if (!body.title) {
    return Response.json({ error: "title required" }, { status: 400 });
  }

  const notif = await createNotification({
    projectId: id,
    type: (body.type as never) || "ACTIVITY",
    title: body.title,
    message: body.message || "",
    senderName: body.senderName || access.name,
    senderRole: body.senderRole || (access.role === "leader" ? "Leader" : "Member"),
    recipientEmail: body.recipientEmail ?? null,
    priority: (body.priority as never) || "normal",
    relatedTaskId: body.relatedTaskId,
    relatedTaskTitle: body.relatedTaskTitle,
    relatedMailId: body.relatedMailId,
    actionUrl: body.actionUrl,
    actionLabel: body.actionLabel,
    extra: body.extra,
  });

  return Response.json({ success: true, notification: notif });
}
