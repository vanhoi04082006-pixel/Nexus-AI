// NEXUS AI - GET/PATCH/DELETE /api/projects/[id]/mailbox/[mailId]
// GET: fetch a single mail with full body + attachments (marks as read as a side-effect
//      only if query ?autoRead=1 is passed; default is NOT auto-read so the client
//      controls read state explicitly).
// PATCH: update per-user mailbox state (read/unread, star/unstar, archive, trash, move folder).
// DELETE: permanently delete the mail (leader only) — members only soft-delete (trash).

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseEmailArray(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; mailId: string }> }
) {
  const { id, mailId } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const autoRead = url.searchParams.get("autoRead") === "1";

  const access = await resolveAccess(id, token);
  if (!access) return Response.json({ error: "Access denied" }, { status: 403 });
  const userEmail = access.email || access.name;

  const email = await db.email.findUnique({
    where: { id: mailId },
    include: {
      attachments: { select: { id: true, filename: true, size: true, mimeType: true } },
    },
  });
  if (!email || email.projectId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // FIX IDOR: Verify caller is an actual recipient (to/cc/bcc) or the sender.
  // Previously any project member could read any mail in the project.
  const isLeader = access.role === "leader";
  const recipients = [
    email.fromEmail,
    ...parseEmailArray(email.toEmails),
    ...parseEmailArray(email.ccEmails),
    ...parseEmailArray(email.bccEmails),
  ].map((e) => e.toLowerCase());
  if (!isLeader && !recipients.includes(userEmail.toLowerCase())) {
    return Response.json({ error: "Bạn không phải người nhận của email này" }, { status: 403 });
  }

  // Find the user's mailbox row (sender has SENT, recipients have INBOX)
  let mailbox = await db.mailbox.findUnique({
    where: { emailId_userEmail: { emailId: mailId, userEmail } },
  });

  // If no mailbox row exists (e.g. leader viewing a mail they sent), create a SENT row
  // FIX: Only auto-create if user is sender or recipient (already verified above)
  if (!mailbox) {
    mailbox = await db.mailbox.create({
      data: {
        emailId: mailId,
        userEmail,
        folder: email.fromEmail === userEmail ? "SENT" : "INBOX",
        isRead: email.fromEmail === userEmail,
        readAt: email.fromEmail === userEmail ? new Date() : null,
      },
    });
  }

  // Optionally auto-mark as read
  if (autoRead && !mailbox.isRead) {
    mailbox = await db.mailbox.update({
      where: { id: mailbox.id },
      data: { isRead: true, readAt: new Date() },
    });
    // Also write a MailRead receipt
    await db.mailRead.upsert({
      where: { emailId_userEmail: { emailId: mailId, userEmail } },
      update: { readAt: new Date(), via: "MAILBOX" },
      create: { emailId: mailId, userEmail, via: "MAILBOX" },
    });
  }

  const project = await db.project.findUnique({ where: { id }, select: { topic: true } });

  return Response.json({
    mail: {
      id: email.id,
      projectId: email.projectId,
      projectTopic: project?.topic || "",
      fromEmail: email.fromEmail,
      fromName: email.fromName,
      toEmails: parseEmailArray(email.toEmails),
      ccEmails: parseEmailArray(email.ccEmails),
      bccEmails: parseEmailArray(email.bccEmails),
      subject: email.subject,
      bodyHtml: email.bodyHtml,
      bodyText: email.bodyText,
      type: email.type,
      smtpStatus: email.smtpStatus,
      smtpError: email.smtpError,
      smtpMessageId: email.smtpMessageId,
      parentEmailId: email.parentEmailId,
      sentAt: email.sentAt?.toISOString() || null,
      createdAt: email.createdAt.toISOString(),
      attachments: email.attachments,
    },
    mailbox: {
      folder: mailbox.folder,
      isRead: mailbox.isRead,
      isStarred: mailbox.isStarred,
      isArchived: mailbox.isArchived,
      isTrashed: mailbox.isTrashed,
      readAt: mailbox.readAt?.toISOString() || null,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; mailId: string }> }
) {
  const { id, mailId } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const access = await resolveAccess(id, token);
  if (!access) return Response.json({ error: "Access denied" }, { status: 403 });
  const userEmail = access.email || access.name;

  const body = (await req.json().catch(() => ({}))) as {
    isRead?: boolean;
    isStarred?: boolean;
    isArchived?: boolean;
    isTrashed?: boolean;
    folder?: string; // move to folder
  };

  // Verify the mail exists in this project
  const email = await db.email.findUnique({ where: { id: mailId } });
  if (!email || email.projectId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Find or create mailbox row
  let mailbox = await db.mailbox.findUnique({
    where: { emailId_userEmail: { emailId: mailId, userEmail } },
  });
  if (!mailbox) {
    mailbox = await db.mailbox.create({
      data: {
        emailId: mailId,
        userEmail,
        folder: email.fromEmail === userEmail ? "SENT" : "INBOX",
        isRead: email.fromEmail === userEmail,
      },
    });
  }

  const update: { [key: string]: unknown } = {};
  if (typeof body.isRead === "boolean") {
    update.isRead = body.isRead;
    update.readAt = body.isRead ? new Date() : null;
    if (body.isRead) {
      // Write/upsert MailRead receipt
      await db.mailRead.upsert({
        where: { emailId_userEmail: { emailId: mailId, userEmail } },
        update: { readAt: new Date(), via: "MAILBOX" },
        create: { emailId: mailId, userEmail, via: "MAILBOX" },
      });
    } else {
      await db.mailRead.deleteMany({ where: { emailId: mailId, userEmail } });
    }
  }
  if (typeof body.isStarred === "boolean") update.isStarred = body.isStarred;
  if (typeof body.isArchived === "boolean") {
    update.isArchived = body.isArchived;
    if (body.isArchived) update.isTrashed = false;
  }
  if (typeof body.isTrashed === "boolean") {
    update.isTrashed = body.isTrashed;
    update.trashedAt = body.isTrashed ? new Date() : null;
    if (body.isTrashed) update.isArchived = false;
  }
  if (body.folder) {
    update.folder = body.folder;
    if (body.folder === "TRASH") {
      update.isTrashed = true;
      update.trashedAt = new Date();
    } else if (body.folder === "ARCHIVE") {
      update.isArchived = true;
      update.isTrashed = false;
    }
  }

  mailbox = await db.mailbox.update({ where: { id: mailbox.id }, data: update });

  return Response.json({ success: true, mailbox });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; mailId: string }> }
) {
  const { id, mailId } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const access = await resolveAccess(id, token);
  if (!access) return Response.json({ error: "Access denied" }, { status: 403 });
  const userEmail = access.email || access.name;
  const isLeader = requireLeader(access);

  const email = await db.email.findUnique({ where: { id: mailId } });
  if (!email || email.projectId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (isLeader) {
    // Leader: permanently delete the email + all mailbox rows
    await db.email.delete({ where: { id: mailId } });
    return Response.json({ success: true, permanent: true });
  } else {
    // Member: only soft-delete (trash) their own mailbox row
    await db.mailbox.updateMany({
      where: { emailId: mailId, userEmail },
      data: { isTrashed: true, trashedAt: new Date(), folder: "TRASH" },
    });
    return Response.json({ success: true, permanent: false });
  }
}
