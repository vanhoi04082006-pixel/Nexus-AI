// NEXUS AI - GET /api/projects/[id]/mailbox/attachments/[attId]
// Download a single attachment. Returns the raw file content with proper headers.

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; attId: string }> }
) {
  const { id, attId } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const access = await resolveAccess(id, token);
  if (!access) return Response.json({ error: "Access denied" }, { status: 403 });

  const att = await db.emailAttachment.findUnique({ where: { id: attId } });
  if (!att) return Response.json({ error: "Not found" }, { status: 404 });

  // Verify the attachment's email belongs to this project
  const email = await db.email.findUnique({
    where: { id: att.emailId },
    select: { projectId: true },
  });
  if (!email || email.projectId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = Buffer.from(att.content, "base64");
  return new Response(buffer, {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(att.filename)}"`,
      "Content-Length": String(att.size),
    },
  });
}
