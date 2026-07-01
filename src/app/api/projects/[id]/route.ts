// NEXUS AI - GET /api/projects/[id]
// Returns the full workspace data for a project.

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";
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
      include: {
        members: { orderBy: { createdAt: "asc" } },
        analyses: true,
        editProposals: { orderBy: { createdAt: "desc" }, include: { member: true } },
        tasks: { include: { member: true }, orderBy: { createdAt: "asc" } },
      },
    });

    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    // Reconstruct result object keyed by section type
    const result: Record<string, unknown> = {};
    for (const a of project.analyses) {
      try {
        result[a.type] = JSON.parse(a.content);
      } catch {
        result[a.type] = {};
      }
    }

    // Recent chat messages (last 50)
    const chatMessages = await db.chatMessage.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { member: true },
    });
    chatMessages.reverse();

    const isLeader = access.role === "leader";

    // Members: hide inviteToken unless leader
    const members = project.members.map((m) => {
      const pub = publicMember(m);
      return isLeader ? { ...pub, inviteToken: m.inviteToken } : pub;
    });

    return Response.json({
      project: {
        id: project.id,
        topic: project.topic,
        description: project.description,
        purpose: project.purpose,
        status: project.status,
        leaderName: project.leaderName,
        leaderEmail: project.leaderEmail,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        // GitHub integration (only leader sees token existence)
        githubConnected: isLeader ? !!project.githubToken : false,
        githubUsername: isLeader ? project.githubUsername : null,
        githubRepoName: project.githubRepoName || null,
        githubPushedAt: project.githubPushedAt?.toISOString() || null,
      },
      result,
      members,
      access,
      leaderToken: isLeader ? project.leaderToken : undefined,
      editProposals: project.editProposals.map((p) => ({
        id: p.id,
        projectId: p.projectId,
        memberId: p.memberId,
        memberName: p.member?.name || null,
        section: p.section,
        requestedChange: p.requestedChange,
        status: p.status,
        createdAt: p.createdAt,
      })),
      tasks: project.tasks.map((t) => ({
        id: t.id,
        assigneeName: t.assigneeName,
        memberId: t.memberId,
        memberName: t.member?.name || null,
        title: t.title,
        description: t.description,
        role: t.role,
        responsibilities: t.responsibilities,
        codeConventions: t.codeConventions,
        dependencies: t.dependencies,
        acceptanceCriteria: t.acceptanceCriteria,
        deadline: t.deadline,
        sprintName: t.sprintName,
        status: t.status,
        hours: t.hours,
        priority: t.priority,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      chatMessages: chatMessages.map((m) => ({
        id: m.id,
        memberId: m.memberId,
        authorName: m.authorName,
        authorRole: m.authorRole,
        message: m.message,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch project", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
