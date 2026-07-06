// NEXUS AI - GET /api/projects/[id]
// Returns the full workspace data for a project.

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";
import { logActivity } from "@/lib/activity";
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

    // Fallback: generate UML diagrams if empty (from analysis + design data)
    const umlData = (result.uml || {}) as { useCase?: string; classDiagram?: string; erd?: string; sequence?: string };
    if (!umlData.useCase || !umlData.classDiagram || !umlData.erd || !umlData.sequence) {
      const analysis = (result.analysis || {}) as { actors?: { name: string }[]; features?: { name: string }[]; modules?: string[] };
      const design = (result.design || {}) as { dbTables?: { name: string }[] };
      const actors = (analysis.actors || []).map((a) => a.name);
      const features = (analysis.features || []).map((f) => f.name);
      const modules = analysis.modules || [];
      const tables = (design.dbTables || []).map((t) => t.name);

      if (!umlData.useCase) {
        const aList = actors.length > 0 ? actors : ["User"];
        const fList = features.length > 0 ? features : modules.length > 0 ? modules : ["Core"];
        umlData.useCase = `graph TD\n    ${aList.map((a, i) => fList.map((f, j) => `Actor${i}["${a}"] --> F${j}["${f}"]`).join("\n    ")).join("\n    ")}`;
      }
      if (!umlData.classDiagram) {
        const tList = tables.length > 0 ? tables : modules.length > 0 ? modules : ["Core"];
        const classes = tList.map((t) => `class ${t.replace(/[^A-Za-z0-9]/g, "")} {\n    +int id\n    +string name\n    +DateTime createdAt\n}`).join("\n\n");
        const rel = tList.length > 1 ? `\n${tList[0].replace(/[^A-Za-z0-9]/g, "")} "1" --> "*" ${tList[1].replace(/[^A-Za-z0-9]/g, "")} : "has"` : "";
        umlData.classDiagram = `classDiagram\n${classes}${rel}`;
      }
      if (!umlData.erd) {
        umlData.erd = tables.length > 0
          ? `erDiagram\n${tables.map((t) => `    ${t.replace(/[^A-Za-z0-9_]/g, "_")} {\n        int id PK\n        string name\n    }`).join("\n")}\n${tables.length > 1 ? `    ${tables[0].replace(/[^A-Za-z0-9_]/g, "_")} ||--o{ ${tables[1].replace(/[^A-Za-z0-9_]/g, "_")} : "has"` : ""}`
          : `erDiagram\n    CORE {\n        int id PK\n        string name\n    }`;
      }
      if (!umlData.sequence) {
        const seqActor = actors.length > 0 ? actors[0] : "User";
        umlData.sequence = `sequenceDiagram\n    participant U as ${seqActor}\n    participant S as System\n    U->>S: Request\n    S-->>U: Response`;
      }
      result.uml = umlData;
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
        leaderEmail: isLeader ? project.leaderEmail : null,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        // GitHub integration (only leader sees token existence + repo details)
        githubConnected: isLeader ? !!project.githubToken : false,
        githubUsername: isLeader ? project.githubUsername : null,
        githubRepoName: isLeader ? project.githubRepoName : null,
        githubPushedAt: isLeader ? project.githubPushedAt?.toISOString() || null : null,
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
        layer: t.layer,
        targetFile: t.targetFile,
        implementationSteps: t.implementationSteps,
        technicalHints: t.technicalHints,
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

// ===== DELETE: Delete project + all related data =====
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    const access = await resolveAccess(id, token);
    if (!requireLeader(access)) {
      return Response.json({ error: "Leader access required to delete" }, { status: 403 });
    }

    // Capture project info BEFORE deleting (so we can log activity with FK intact)
    const project = await db.project.findUnique({
      where: { id },
      select: { topic: true, leaderName: true, leaderEmail: true },
    });

    // Log the deletion FIRST (project FK must still exist for ActivityLog.projectId)
    try {
      await logActivity({
        projectId: id,
        type: "PROJECT_DELETED",
        status: "WARNING",
        title: `${access?.name || project?.leaderName || "Leader"} xóa dự án`,
        details: project?.topic || "",
        actorName: access?.name || project?.leaderName || "",
        actorEmail: access?.email || project?.leaderEmail || "",
        actorRole: "Leader",
      });
    } catch { /* non-fatal */ }

    // Delete project — cascade will delete all related records (members, analyses, tasks, etc.)
    await db.project.delete({
      where: { id },
    });

    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: "Failed to delete project", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}

// ===== PATCH: Update project metadata (favorite, archive, rename, priority, deadline, tags, techStack, coverColor) =====
export async function PATCH(
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

    const body = (await req.json()) as {
      topic?: string;
      description?: string;
      isFavorite?: boolean;
      isArchived?: boolean;
      priority?: string;
      deadline?: string | null;
      techStack?: string[];
      tags?: string[];
      coverColor?: string;
      status?: string;
    };

    const data: Record<string, unknown> = {};
    if (typeof body.topic === "string" && body.topic.trim()) data.topic = body.topic.trim();
    if (typeof body.description === "string") data.description = body.description;
    if (typeof body.isFavorite === "boolean") data.isFavorite = body.isFavorite;
    if (typeof body.isArchived === "boolean") data.isArchived = body.isArchived;
    if (typeof body.priority === "string") data.priority = body.priority;
    if (body.deadline !== undefined) data.deadline = body.deadline ? new Date(body.deadline) : null;
    if (Array.isArray(body.techStack)) data.techStack = JSON.stringify(body.techStack);
    if (Array.isArray(body.tags)) data.tags = JSON.stringify(body.tags);
    if (typeof body.coverColor === "string") data.coverColor = body.coverColor;
    if (typeof body.status === "string") data.status = body.status;

    const updated = await db.project.update({
      where: { id },
      data,
      select: {
        id: true,
        topic: true,
        description: true,
        isFavorite: true,
        isArchived: true,
        priority: true,
        deadline: true,
        techStack: true,
        tags: true,
        coverColor: true,
        status: true,
        updatedAt: true,
      },
    });

    return Response.json({ success: true, project: updated });
  } catch (err) {
    return Response.json(
      { error: "Failed to update project", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
