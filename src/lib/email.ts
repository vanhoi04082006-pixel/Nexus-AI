// NEXUS AI - Email Service
// Sends REAL emails via SMTP (Gmail app password) using nodemailer.
// Also stores every email in the EmailLog table (Mailbox UI) regardless of SMTP success.
// If SMTP fails, the email is still logged so the team can see what would have been sent.

import fs from "fs";
import path from "path";
import { db } from "./db";

// Type for nodemailer transporter (avoid static import — Turbopack crash)
type SmtpTransporter = {
  sendMail: (opts: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }) => Promise<{ messageId: string }>;
};

/**
 * Read the current public URL from .public-url file.
 * This file is updated by scripts/run-local.sh when Cloudflare Tunnel starts,
 * so email links always point to the accessible URL (not localhost).
 * Falls back to env var or localhost.
 */
function baseUrl(): string {
  // In production with env var set, use that
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl && !envUrl.includes("localhost")) {
    return envUrl;
  }
  // Try reading from .public-url file (updated by tunnel script)
  try {
    const urlPath = path.join(process.cwd(), ".public-url");
    const fileContent = fs.readFileSync(urlPath, "utf-8").trim();
    if (fileContent && fileContent.startsWith("http")) {
      return fileContent;
    }
  } catch {
    /* file not found — fall through */
  }
  // Default fallback
  return envUrl || "http://localhost:3000";
}

export interface SendArgs {
  projectId: string;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  type: "INVITATION" | "REMINDER" | "TASK_ASSIGNED";
}

/** Track SMTP verification result per project to avoid re-verifying every email */
const smtpVerified = new Map<string, boolean>();
let smtpWarningLogged = false;

/** Cache transporters by projectId to avoid creating a new SMTP connection per email */
const transporterCache = new Map<string, SmtpTransporter>();

/**
 * Store the email in the EmailLog table (always — for the Mailbox UI).
 */
async function logEmail(args: SendArgs): Promise<void> {
  await db.emailLog.create({
    data: {
      projectId: args.projectId,
      toEmail: args.toEmail,
      toName: args.toName,
      subject: args.subject,
      body: args.body,
      type: args.type,
    },
  });
}

/**
 * Get an SMTP transporter for the project's leader credentials.
 * Returns null if no SMTP password is configured (mock mode).
 * Uses dynamic import so nodemailer (Node native deps) doesn't crash Turbopack.
 */
async function getTransporter(
  projectId: string
): Promise<SmtpTransporter | null> {
  // Check cache first — avoids re-creating SMTP connection per email
  const cached = transporterCache.get(projectId);
  if (cached) return cached;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { leaderEmail: true, leaderSmtpPassword: true },
  });
  if (!project || !project.leaderEmail || !project.leaderSmtpPassword) {
    return null;
  }

  // Dynamic import — avoids loading nodemailer at module init
  const nodemailer = await import("nodemailer");

  const domain = project.leaderEmail.split("@")[1]?.toLowerCase() || "";
  let host = "smtp.gmail.com";
  let port = 587;
  if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) {
    host = "smtp-mail.outlook.com";
    port = 587;
  } else if (domain.includes("yahoo")) {
    host = "smtp.mail.yahoo.com";
    port = 587;
  } else if (domain.includes("zoho")) {
    host = "smtp.zoho.com";
    port = 587;
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: project.leaderEmail,
      pass: project.leaderSmtpPassword,
    },
  });

  const transporter = transport as unknown as SmtpTransporter;
  // Cache for reuse (nodemailer pools connections)
  transporterCache.set(projectId, transporter);
  return transporter;
}

/**
 * Send an email via SMTP. If SMTP is not configured or fails, the email is
 * still logged to the EmailLog table (Mailbox UI) so the flow is unaffected.
 * Verifies SMTP credentials on first use and logs a clear warning if invalid.
 */
export async function sendEmail(args: SendArgs): Promise<void> {
  // Always log first
  await logEmail(args);

  // Try real SMTP
  try {
    const transporter = await getTransporter(args.projectId);
    if (!transporter) {
      console.log(`  [EMAIL] No SMTP configured — logged to Mailbox only: ${args.toEmail}`);
      return;
    }

    // Verify SMTP credentials on first use for this project
    if (!smtpVerified.has(args.projectId)) {
      try {
        // nodemailer transporter has verify() — cast to access it
        await (transporter as unknown as { verify: () => Promise<unknown> }).verify();
        smtpVerified.set(args.projectId, true);
        console.log(`  [EMAIL] SMTP verified OK for project ${args.projectId}`);
      } catch (verifyErr) {
        smtpVerified.set(args.projectId, false);
        const msg = verifyErr instanceof Error ? verifyErr.message : "unknown";
        if (!smtpWarningLogged) {
          console.error(`  [EMAIL] ⚠ SMTP AUTH FAILED — emails will be logged but NOT sent: ${msg}`);
          smtpWarningLogged = true;
        }
        return; // skip sending — credentials are wrong
      }
    } else if (smtpVerified.get(args.projectId) === false) {
      // Already verified as failed — skip
      return;
    }

    const project = await db.project.findUnique({
      where: { id: args.projectId },
      select: { leaderEmail: true, leaderName: true, topic: true },
    });

    const info = await transporter.sendMail({
      from: `"${project?.leaderName || "NEXUS AI"}" <${project?.leaderEmail}>`,
      to: `${args.toName} <${args.toEmail}>`,
      subject: args.subject,
      text: args.body,
    });

    console.log(`  [EMAIL] SENT via SMTP to ${args.toEmail} — messageId: ${info.messageId}`);
  } catch (err) {
    // SMTP failed — but email is already logged. Don't break the flow.
    console.error(
      `  [EMAIL] SMTP send FAILED to ${args.toEmail}:`,
      err instanceof Error ? err.message : "unknown"
    );
  }
}

export async function sendInvitationEmails(
  projectId: string,
  topic: string,
  leaderName: string,
  members: { id: string; name: string; email: string; inviteToken: string }[]
): Promise<void> {
  for (const m of members) {
    const link = `${baseUrl()}/?p=${projectId}&token=${m.inviteToken}`;
    const subject = `[NEXUS AI] Loi moi tham gia du an "${topic}"`;
    const body = `Xin chao ${m.name},

${leaderName} da moi ban tham gia du an "${topic}" tren NEXUS AI - Multi-Agent Architect.

8 AI Agent da phan tich va thiet ke du an. Ban duoc moi vao khong gian lam viec chung de:
- Xem phan tich chu de, phan nhan su, sprint planning, thiet ke he thong, UML, tai lieu, git
- Tham gia thao luan cung nhom
- De xuat chinh sua (nhom truong se duyet)

Nhan vao link duoi day de truy cap khong gian lam viec:
${link}

Tran trong,
NEXUS AI`;
    await sendEmail({ projectId, toEmail: m.email, toName: m.name, subject, body, type: "INVITATION" });
  }
}

export async function sendTaskAssignedEmail(
  projectId: string,
  topic: string,
  member: { name: string; email: string; inviteToken: string },
  tasks: { title: string; deadline: string | null }[]
): Promise<void> {
  const link = `${baseUrl()}/?p=${projectId}&token=${member.inviteToken}`;
  const taskList = tasks.map((t) => `  - ${t.title} (deadline: ${t.deadline || "N/A"})`).join("\n");
  const subject = `[NEXUS AI] Task moi duoc gan cho ban trong du an "${topic}"`;
  const body = `Xin chao ${member.name},

Du an "${topic}" da duoc khoi tao. Ban co ${tasks.length} task moi:

${taskList}

Truy cap khong gian lam viec de xem chi tiet:
${link}

Tran trong,
NEXUS AI`;
  await sendEmail({ projectId, toEmail: member.email, toName: member.name, subject, body, type: "TASK_ASSIGNED" });
}

export async function sendDeadlineReminder(
  projectId: string,
  topic: string,
  member: { name: string; email: string },
  taskTitle: string,
  deadline: string
): Promise<void> {
  const subject = `[NEXUS AI] Nho deadline: "${taskTitle}" - ${deadline}`;
  const body = `Xin chao ${member.name},

Day la nhac nho: task "${taskTitle}" trong du an "${topic}" co deadline vao ${deadline}.
Vui long hoan thanh hoac cap nhat trang thai.

Tran trong,
NEXUS AI`;
  await sendEmail({ projectId, toEmail: member.email, toName: member.name, subject, body, type: "REMINDER" });
}
