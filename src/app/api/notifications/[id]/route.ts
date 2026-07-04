// NEXUS AI - PATCH /api/notifications/[id]
// Mark a notification as read/unread

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as { read?: boolean };
  const updated = await db.notification.update({
    where: { id },
    data: { read: body.read ?? true },
  });
  return Response.json({ success: true, notification: updated });
}

// Delete notification
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.notification.delete({ where: { id } });
  return Response.json({ success: true });
}
