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
    select: { projectId: true, fromEmail: true, toEmails: true, ccEmails: true, bccEmails: true },
  });
  if (!email || email.projectId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // FIX IDOR: Verify caller is a recipient or sender of the email this attachment belongs to.
  // Previously any project member could download any attachment.
  const isLeader = access.role === "leader";
  const userEmail = (access.email || access.name).toLowerCase();
  const parseArr = (raw: string): string[] => {
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((x) => typeof x === "string") : []; }
    catch { return []; }
  };
  const recipients = [
    email.fromEmail,
    ...parseArr(email.toEmails),
    ...parseArr(email.ccEmails),
    ...parseArr(email.bccEmails),
  ].map((e) => e.toLowerCase());
  if (!isLeader && !recipients.includes(userEmail)) {
    return Response.json({ error: "Bạn không có quyền tải file đính kèm này" }, { status: 403 });
  }

  // FIX: Force safe Content-Type to prevent XSS via SVG/HTML attachments
  const SAFE_MIME_TYPES = new Set([
    "application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp",
    "text/plain", "application/zip", "application/x-zip-compressed",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint",
  ]);
  const safeMimeType = SAFE_MIME_TYPES.has(att.mimeType) ? att.mimeType : "application/octet-stream";

  const buffer = Buffer.from(att.content, "base64");
  return new Response(buffer, {
    headers: {
      "Content-Type": safeMimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(att.filename)}"`,
      "Content-Length": String(att.size),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
