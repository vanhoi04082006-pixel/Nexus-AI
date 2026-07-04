// NEXUS AI - PATCH/DELETE /api/projects/[id]/notifications/[notifId]
// PATCH: mark a single notification as read (or unread) for the current user.
//        Body: { read?: boolean }  (default true)
// DELETE: delete a notification (leader only).

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; notifId: string }> }
) {
  const { id, notifId } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const access = await resolveAccess(id, token);
  if (!access) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }
  const userEmail = access.email || access.name;
  const body = (await req.json().catch(() => ({}))) as { read?: boolean };
  const wantRead = body.read ?? true;

  // Verify the notification belongs to this project + is visible to the user
  const notif = await db.notification.findUnique({
    where: { id: notifId },
  });
  if (!notif || notif.projectId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const visibleToUser =
    notif.recipientEmail === null || notif.recipientEmail === userEmail;
  if (!visibleToUser) {
    return Response.json({ error: "Not addressed to you" }, { status: 403 });
  }

  if (wantRead) {
    // Upsert a NotificationRead row
    await db.notificationRead.upsert({
      where: {
        notificationId_readerEmail: {
          notificationId: notifId,
          readerEmail: userEmail,
        },
      },
      update: { readAt: new Date() },
      create: {
        notificationId: notifId,
        readerEmail: userEmail,
      },
    });
  } else {
    // Unread — remove the NotificationRead row
    await db.notificationRead.deleteMany({
      where: { notificationId: notifId, readerEmail: userEmail },
    });
  }

  return Response.json({ success: true, read: wantRead });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; notifId: string }> }
) {
  const { id, notifId } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const access = await resolveAccess(id, token);
  if (!access) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  const notif = await db.notification.findUnique({
    where: { id: notifId },
  });
  if (!notif || notif.projectId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Leader can delete any; members can only delete notifications addressed to them
  const isLeader = requireLeader(access);
  if (!isLeader) {
    const userEmail = access.email || access.name;
    if (notif.recipientEmail !== null && notif.recipientEmail !== userEmail) {
      return Response.json({ error: "Only leader can delete broadcast notifications" }, { status: 403 });
    }
  }

  await db.notification.delete({ where: { id: notifId } });
  return Response.json({ success: true });
}
