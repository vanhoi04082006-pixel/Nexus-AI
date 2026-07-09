// NEXUS AI - POST /api/projects/[id]/mailbox/attachments
// Upload one or more attachments for a draft email. Returns attachment IDs + metadata.
// Body (multipart/form-data):
//   - files: File[]  (one or more files)
//   - emailId?: string (optional — if draft already has an Email row)
//
// Returns: { attachments: [{ id, filename, size, mimeType }] }

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    const access = await resolveAccess(id, token);
    if (!access) return Response.json({ error: "Access denied" }, { status: 403 });
    if (!requireLeader(access)) {
      return Response.json({ error: "Chỉ leader được upload attachment" }, { status: 403 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return Response.json({ error: "No files provided" }, { status: 400 });
    }

    const emailId = formData.get("emailId") as string | null;

    // If emailId provided, verify it belongs to this project
    if (emailId) {
      const email = await db.email.findUnique({ where: { id: emailId } });
      if (!email || email.projectId !== id) {
        return Response.json({ error: "Email not found in this project" }, { status: 404 });
      }
    }

    const attachments: { id: string; filename: string; size: number; mimeType: string }[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return Response.json(
          { error: `File ${file.name} quá lớn (tối đa 5MB)` },
          { status: 413 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64Content = buffer.toString("base64");

      const att = await db.emailAttachment.create({
        data: {
          emailId: emailId || "PENDING", // placeholder — will be re-linked when email is sent
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          content: base64Content,
        },
      });
      attachments.push({
        id: att.id,
        filename: att.filename,
        size: att.size,
        mimeType: att.mimeType,
      });
    }

    // Log upload activity for the dashboard feed
    try {
      await logActivity({
        projectId: id,
        type: "DOC_UPLOADED",
        status: "SUCCESS",
        title: `${access.name} upload ${attachments.length} file`,
        details: attachments.map((a) => a.filename).join(", "),
        actorName: access.name,
        actorEmail: access.email,
        actorRole: "Leader",
        actionUrl: `/?p=${id}&tab=mailbox`,
        actionLabel: "Mở Mailbox",
      });
    } catch { /* non-fatal */ }

    return Response.json({ attachments });
  } catch (err) {
    return Response.json(
      { error: "Upload failed", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
