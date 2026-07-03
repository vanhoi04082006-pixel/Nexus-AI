// NEXUS AI - GET/POST /api/projects/[id]/notifications
// GET: List notifications for a project
// POST: Create a notification (for task status changes, proposals, etc.)

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";

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

  const notifications = await db.notification.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unread = notifications.filter((n) => !n.read).length;

  return Response.json({ notifications, unread });
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

  const body = (await req.json()) as {
    type: string;
    title: string;
    message: string;
  };

  if (!body.title) {
    return Response.json({ error: "title required" }, { status: 400 });
  }

  const notification = await db.notification.create({
    data: {
      projectId: id,
      type: body.type || "ACTIVITY",
      title: body.title,
      message: body.message || "",
      read: false,
    },
  });

  return Response.json({ success: true, notification });
}
