// NEXUS AI - GET/POST /api/projects/[id]/members
// Leader can add a new member (creates inviteToken, sends invitation email).
// Any access can list members; inviteToken hidden unless leader.

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";
import { sendInvitationEmails } from "@/lib/email";
import { publicMember } from "@/app/api/projects/_lib/reconstruct";

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

    const project = await db.project.findUnique({
      where: { id },
      include: { members: { orderBy: { createdAt: "asc" } } },
    });
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

    const isLeader = access.role === "leader";
    const members = project.members.map((m) => {
      const pub = publicMember(m);
      return isLeader ? { ...pub, inviteToken: m.inviteToken } : pub;
    });

    return Response.json({ members });
  } catch (err) {
    return Response.json(
      { error: "Failed to list members", details: err instanceof Error ? err.message : "unknown" },
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
    if (!requireLeader(access)) {
      return Response.json({ error: "Leader access required" }, { status: 403 });
    }

    const project = await db.project.findUnique({ where: { id } });
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

    const body = (await req.json()) as {
      name: string;
      email: string;
      strengths?: string;
      weaknesses?: string;
    };

    if (!body || !body.name || !body.name.trim()) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }
    if (!body.email || !body.email.trim()) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const member = await db.member.create({
      data: {
        projectId: id,
        name: body.name.trim(),
        email: body.email.trim(),
        strengths: body.strengths || "",
        weaknesses: body.weaknesses || "",
      },
    });

    // Send invitation email to the new member
    try {
      await sendInvitationEmails(id, project.topic, project.leaderName, [
        {
          id: member.id,
          name: member.name,
          email: member.email,
          inviteToken: member.inviteToken,
        },
      ]);
    } catch {
      /* non-fatal */
    }

    const pub = publicMember(member);
    return Response.json({
      member: { ...pub, inviteToken: member.inviteToken },
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to add member", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
