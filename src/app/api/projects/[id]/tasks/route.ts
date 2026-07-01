// NEXUS AI - GET /api/projects/[id]/tasks
// Returns all tasks for the project, including member info.

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";

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

    const tasks = await db.task.findMany({
      where: { projectId: id },
      include: { member: true },
      orderBy: [{ sprintName: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
    });

    return Response.json({
      tasks: tasks.map((t) => ({
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
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch tasks", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
