// NEXUS AI - POST /api/projects/[id]/chat/ai
// AI assistant replies in the team chat. Reconstructs input + result from DB,
// then calls chatAssistant() and persists the reply as a ChatMessage.

import { db } from "@/lib/db";
import { chatAssistant } from "@/lib/ai";
import { resolveAccess } from "@/lib/access";
import {
  reconstructInput,
  reconstructResult,
} from "@/app/api/projects/_lib/reconstruct";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

    const body = (await req.json()) as { recentMessages: string };
    if (!body || typeof body.recentMessages !== "string") {
      return Response.json({ error: "recentMessages string is required" }, { status: 400 });
    }

    const input = await reconstructInput(id);
    if (!input) return Response.json({ error: "Project not found" }, { status: 404 });
    const result = await reconstructResult(id);

    let reply: string;
    try {
      reply = await chatAssistant(input, result, body.recentMessages);
    } catch (err) {
      reply = `Xin loi, toi khong the phan hoi luc nay. (${
        err instanceof Error ? err.message : "unknown"
      })`;
    }

    if (!reply || !reply.trim()) {
      reply = "Xin loi, toi khong the phan hoi luc nay.";
    }

    const created = await db.chatMessage.create({
      data: {
        projectId: id,
        memberId: null,
        authorName: "NEXUS AI",
        authorRole: "ai",
        message: reply.trim(),
      },
    });

    return Response.json({
      message: {
        id: created.id,
        memberId: null,
        authorName: created.authorName,
        authorRole: created.authorRole,
        message: created.message,
        createdAt: created.createdAt,
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to get AI reply", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
