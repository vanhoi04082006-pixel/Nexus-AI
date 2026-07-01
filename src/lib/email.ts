// NEXUS AI - Mock Email Service
// In this sandbox we cannot send real SMTP emails, so we store every email
// in the database (EmailLog) and expose a "Mailbox" UI where members can read
// what they would have received. This keeps the full flow functional end-to-end.

import { db } from "./db";

function baseUrl(): string {
  // The preview is served from the gateway; use a relative URL so it works
  // in both the sandbox and the user's preview panel.
  return "";
}

export interface SendArgs {
  projectId: string;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  type: "INVITATION" | "REMINDER" | "TASK_ASSIGNED";
}

export async function sendEmail(args: SendArgs): Promise<void> {
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

(Luu y: Day la email mo phong trong moi truong sandbox. Trong thuc te, link se duoc gui qua SMTP.)

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
