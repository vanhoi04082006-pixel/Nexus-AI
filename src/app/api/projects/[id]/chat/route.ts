// NEXUS AI - GET/POST /api/projects/[id]/chat
// Persists chat messages. Real-time broadcast is handled by the separate
// Socket.io service on port 3001; this route is the source of truth for storage.

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    const access = await resolveAccess(id, token);
    if (!access) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const messages = await db.chatMessage.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { member: true },
    });
    messages.reverse();

    return Response.json({
      messages: messages.map((m) => ({
        id: m.id,
        memberId: m.memberId,
        authorName: m.authorName,
        authorRole: m.authorRole,
        message: m.message,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch chat", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    const access = await resolveAccess(id, token);
    if (!access) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = (await req.json()) as { message: string };
    if (!body || typeof body.message !== "string" || !body.message.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const created = await db.chatMessage.create({
      data: {
        projectId: id,
        memberId: access.role === "member" ? access.memberId : null,
        authorName: access.name,
        authorRole: access.role,
        message: body.message.trim(),
      },
    });

    return Response.json({
      message: {
        id: created.id,
        memberId: created.memberId,
        authorName: created.authorName,
        authorRole: created.authorRole,
        message: created.message,
        createdAt: created.createdAt,
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to send message", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
