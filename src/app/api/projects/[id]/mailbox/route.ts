// NEXUS AI - GET /api/projects/[id]/mailbox
// Returns EmailLog entries. Members only see emails addressed to their own email;
// leader sees all.

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";

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

    const isLeader = requireLeader(access);

    const emails = await db.emailLog.findMany({
      where: {
        projectId: id,
        ...(isLeader ? {} : { toEmail: access.email || "" }),
      },
      orderBy: { sentAt: "desc" },
    });

    return Response.json({
      emails: emails.map((e) => ({
        id: e.id,
        toEmail: e.toEmail,
        toName: e.toName,
        subject: e.subject,
        body: e.body,
        type: e.type,
        sentAt: e.sentAt,
      })),
      isLeader,
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch mailbox", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
