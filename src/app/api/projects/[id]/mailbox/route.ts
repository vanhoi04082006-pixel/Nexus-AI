// NEXUS AI - GET/POST /api/projects/[id]/mailbox
// GET: list mails for the current user (leader or member) in a given folder.
//      Query: ?token=TOKEN&folder=INBOX|SENT|DRAFT|STARRED|TRASH|ARCHIVE|SPAM&q=SEARCH&page=1&limit=20
// POST: compose + send a mail. Only leader (Project Owner / Team Leader) can send.
//       Real SMTP send via the project's leader credentials, plus DB persistence.

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";
import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_SERVICE_PORT } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ComposeBody {
  toEmails: string[];
  ccEmails?: string[];
  bccEmails?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  // optional: save as draft instead of sending
  asDraft?: boolean;
  // optional: reply/forward parent
  parentEmailId?: string;
}

// JSON parse helper (defensive)
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const folder = url.searchParams.get("folder") || "INBOX";
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));

    const access = await resolveAccess(id, token);
    if (!access) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }
    const userEmail = access.email || access.name;

    // Build the where clause for the user's mailbox rows
    const where: { userEmail: string; [key: string]: unknown } = { userEmail };

    if (folder === "STARRED") {
      where.isStarred = true;
      where.isTrashed = false;
    } else if (folder === "TRASH") {
      where.isTrashed = true;
    } else if (folder === "ARCHIVE") {
      where.isArchived = true;
      where.isTrashed = false;
    } else if (folder === "SPAM") {
      where.folder = "SPAM";
    } else if (folder === "SENT") {
      where.folder = "SENT";
      where.isTrashed = false;
    } else if (folder === "DRAFT") {
      where.folder = "DRAFT";
      where.isTrashed = false;
    } else {
      // INBOX (default)
      where.folder = "INBOX";
      where.isTrashed = false;
      where.isArchived = false;
    }

    // Get mailbox rows (paginated)
    const [total, mailboxes] = await Promise.all([
      db.mailbox.count({ where }),
      db.mailbox.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          email: {
            include: { attachments: { select: { id: true, filename: true, size: true, mimeType: true } } },
          },
        },
      }),
    ]);

    // Filter by search query (subject/body/from)
    let rows = mailboxes.map((mb) => {
      const e = mb.email;
      return {
        id: e.id,
        mailboxId: mb.id,
        fromEmail: e.fromEmail,
        fromName: e.fromName,
        toEmails: parseEmailArray(e.toEmails),
        ccEmails: parseEmailArray(e.ccEmails),
        bccEmails: parseEmailArray(e.bccEmails),
        subject: e.subject,
        bodyPreview: (e.bodyText || e.bodyHtml || "").substring(0, 160),
        bodyHtml: e.bodyHtml,
        bodyText: e.bodyText,
        type: e.type,
        smtpStatus: e.smtpStatus,
        sentAt: e.sentAt?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
        parentEmailId: e.parentEmailId,
        folder: mb.folder,
        isRead: mb.isRead,
        isStarred: mb.isStarred,
        isArchived: mb.isArchived,
        isTrashed: mb.isTrashed,
        readAt: mb.readAt?.toISOString() || null,
        attachments: e.attachments,
      };
    });

    if (q) {
      rows = rows.filter(
        (r) =>
          r.subject.toLowerCase().includes(q) ||
          r.fromName.toLowerCase().includes(q) ||
          r.fromEmail.toLowerCase().includes(q) ||
          r.bodyPreview.toLowerCase().includes(q) ||
          r.toEmails.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Unread count for INBOX (for the mail badge)
    const unreadInbox = await db.mailbox.count({
      where: { userEmail, folder: "INBOX", isRead: false, isTrashed: false },
    });

    // Folder counts for the sidebar
    const folderCounts = await db.mailbox.groupBy({
      by: ["folder"],
      where: { userEmail },
      _count: { _all: true },
    });
    const starredCount = await db.mailbox.count({ where: { userEmail, isStarred: true, isTrashed: false } });
    const trashedCount = await db.mailbox.count({ where: { userEmail, isTrashed: true } });
    const archivedCount = await db.mailbox.count({ where: { userEmail, isArchived: true, isTrashed: false } });

    const counts: Record<string, number> = {};
    for (const fc of folderCounts) counts[fc.folder] = fc._count._all;
    counts["STARRED"] = starredCount;
    counts["TRASH"] = trashedCount;
    counts["ARCHIVE"] = archivedCount;

    return Response.json({
      mails: rows,
      total,
      page,
      limit,
      unreadInbox,
      folderCounts: counts,
      userEmail,
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch mailbox", details: err instanceof Error ? err.message : "unknown" },
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
    // Only leader (Project Owner / Team Leader) can compose/send
    if (!requireLeader(access)) {
      return Response.json({ error: "Chỉ Project Owner / Team Leader được gửi mail" }, { status: 403 });
    }

    const body = (await req.json()) as ComposeBody;
    if (!body.subject || (!body.toEmails || body.toEmails.length === 0)) {
      return Response.json({ error: "subject và toEmails là bắt buộc" }, { status: 400 });
    }

    const project = await db.project.findUnique({
      where: { id },
      select: { id: true, topic: true, leaderName: true, leaderEmail: true, leaderSmtpPassword: true },
    });
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const fromEmail = project.leaderEmail;
    const fromName = project.leaderName;
    const toArr = body.toEmails.filter(Boolean);
    const ccArr = (body.ccEmails || []).filter(Boolean);
    const bccArr = (body.bccEmails || []).filter(Boolean);
    const allRecipients = Array.from(new Set([...toArr, ...ccArr, ...bccArr]));

    const isDraft = !!body.asDraft;

    // 1. Create the Email row
    const email = await db.email.create({
      data: {
        projectId: id,
        fromEmail,
        fromName,
        toEmails: JSON.stringify(toArr),
        ccEmails: JSON.stringify(ccArr),
        bccEmails: JSON.stringify(bccArr),
        subject: body.subject,
        bodyHtml: body.bodyHtml || `<pre>${escapeHtml(body.bodyText || "")}</pre>`,
        bodyText: body.bodyText || stripHtml(body.bodyHtml || ""),
        type: body.parentEmailId ? "REPLY" : "COMPOSE",
        parentEmailId: body.parentEmailId || null,
        smtpStatus: isDraft ? "logged_only" : "pending",
        sentAt: isDraft ? null : new Date(),
      },
    });

    // 2. Create Mailbox rows: SENT for the sender, INBOX for each recipient (if they're a project member)
    await db.mailbox.create({
      data: {
        emailId: email.id,
        userEmail: fromEmail,
        folder: "SENT",
        isRead: true, // sender has "read" their own sent mail
        readAt: new Date(),
      },
    });

    // Resolve which recipients are members of this project (so their inbox gets the mail)
    const members = await db.member.findMany({ where: { projectId: id } });
    const memberEmailSet = new Set(members.map((m) => m.email.toLowerCase()));

    for (const recipient of allRecipients) {
      const emailLower = recipient.toLowerCase();
      // Leader's own email as recipient → skip INBOX row (they already have the SENT row,
      // and the @@unique([emailId, userEmail]) constraint would reject a duplicate)
      const isLeaderSelf = emailLower === fromEmail.toLowerCase();
      if (isLeaderSelf) continue;
      if (!memberEmailSet.has(emailLower)) {
        // External recipient — no Mailbox row (can't log in), but SMTP will still send
        continue;
      }
      await db.mailbox.create({
        data: {
          emailId: email.id,
          userEmail: recipient,
          folder: "INBOX",
          isRead: false,
        },
      });
    }

    // 3. Send via real SMTP (unless draft)
    let smtpStatus = "logged_only";
    let smtpError: string | null = null;
    let smtpMessageId: string | null = null;

    if (!isDraft) {
      const smtpResult = await sendViaSmtp(project, email, toArr, ccArr, bccArr);
      smtpStatus = smtpResult.status;
      smtpError = smtpResult.error;
      smtpMessageId = smtpResult.messageId;
    }

    await db.email.update({
      where: { id: email.id },
      data: { smtpStatus, smtpError, smtpMessageId },
    });

    // 4. Activity log
    await db.activityLog.create({
      data: {
        projectId: id,
        type: "EMAIL_SENT",
        status: smtpStatus === "sent" ? "SUCCESS" : smtpStatus === "failed" ? "FAILED" : "RUNNING",
        title: `${isDraft ? "Draft saved" : "Mail sent"}: ${body.subject}`,
        details: `To: ${toArr.join(", ")}${ccArr.length ? ` | CC: ${ccArr.join(", ")}` : ""}${bccArr.length ? ` | BCC: ${bccArr.length}` : ""} | SMTP: ${smtpStatus}`,
      },
    });

    // 5. Create notifications for each in-project recipient + broadcast realtime
    if (!isDraft) {
      for (const recipient of allRecipients) {
        const emailLower = recipient.toLowerCase();
        const isLeaderSelf = emailLower === fromEmail.toLowerCase();
        if (!isLeaderSelf && !memberEmailSet.has(emailLower)) continue;

        await createNotification({
          projectId: id,
          type: "MAIL_RECEIVED",
          title: `Email mới từ ${fromName}`,
          message: body.subject,
          senderName: fromName,
          senderRole: "Team Leader",
          recipientEmail: recipient,
          priority: "normal",
          relatedMailId: email.id,
          actionUrl: `/?p=${id}&token=${token}&tab=mailbox&mail=${email.id}`,
          actionLabel: "Đọc Email",
          extra: { fromEmail, subject: body.subject },
        });
      }
      // Broadcast mail:new to the WS service
      try {
        await fetch(`http://localhost:${NOTIFICATION_SERVICE_PORT}/broadcast-mail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: id,
            recipientEmails: allRecipients,
            mail: {
              id: email.id,
              subject: body.subject,
              fromName,
              fromEmail,
              createdAt: email.createdAt.toISOString(),
            },
          }),
          signal: AbortSignal.timeout(3000),
        });
      } catch { /* fire-and-forget */ }
    }

    return Response.json({
      success: true,
      emailId: email.id,
      smtpStatus,
      smtpError,
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to send mail", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}

// ===== SMTP helpers =====

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

async function sendViaSmtp(
  project: { leaderEmail: string; leaderSmtpPassword: string | null; leaderName: string; topic: string },
  email: { id: string; subject: string; bodyHtml: string; bodyText: string },
  toArr: string[],
  ccArr: string[],
  bccArr: string[]
): Promise<{ status: string; error: string | null; messageId: string | null }> {
  if (!project.leaderSmtpPassword) {
    return { status: "logged_only", error: "No SMTP password configured — logged to Mailbox only", messageId: null };
  }
  try {
    const nodemailer = await import("nodemailer");
    const domain = project.leaderEmail.split("@")[1]?.toLowerCase() || "";
    let host = "smtp.gmail.com";
    let port = 587;
    if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) {
      host = "smtp-mail.outlook.com";
    } else if (domain.includes("yahoo")) {
      host = "smtp.mail.yahoo.com";
    } else if (domain.includes("zoho")) {
      host = "smtp.zoho.com";
    }
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: project.leaderEmail, pass: project.leaderSmtpPassword },
    });
    const info = await transport.sendMail({
      from: `"${project.leaderName}" <${project.leaderEmail}>`,
      to: toArr.join(", "),
      cc: ccArr.join(", "),
      bcc: bccArr.join(", "),
      subject: email.subject,
      html: email.bodyHtml || `<pre>${escapeHtml(email.bodyText)}</pre>`,
      text: email.bodyText || stripHtml(email.bodyHtml),
    });
    return { status: "sent", error: null, messageId: info.messageId };
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "unknown SMTP error",
      messageId: null,
    };
  }
}
