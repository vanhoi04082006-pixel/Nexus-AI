// NEXUS AI - GET /api/activity/logs
// Returns ActivityLog entries for a specific project (or all user's projects).
// Query: ?token=TOKEN&projectId=ID&limit=50

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const projectId = url.searchParams.get("projectId");
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

  if (!token) {
    return Response.json({ error: "Token required" }, { status: 401 });
  }

  // If projectId provided, verify access
  if (projectId) {
    const access = await resolveAccess(projectId, token);
    if (!access) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }
    const logs = await db.activityLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const project = await db.project.findUnique({ where: { id: projectId }, select: { topic: true } });
    return Response.json({
      logs: logs.map((l) => ({
        id: l.id,
        type: l.type,
        status: l.status,
        title: l.title,
        details: l.details,
        actorName: l.actorName,
        actorRole: l.actorRole,
        relatedTaskTitle: l.relatedTaskTitle,
        actionUrl: l.actionUrl,
        icon: l.icon,
        createdAt: l.createdAt.toISOString(),
        projectTopic: project?.topic || "",
      })),
    });
  }

  // No projectId → return logs across all user's projects
  const projects = await db.project.findMany({
    where: { leaderToken: token },
    select: { id: true, topic: true },
  });
  const projectIds = projects.map((p) => p.id);
  if (projectIds.length === 0) {
    return Response.json({ logs: [] });
  }

  const logs = await db.activityLog.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const projectMap = new Map(projects.map((p) => [p.id, p.topic]));

  return Response.json({
    logs: logs.map((l) => ({
      id: l.id,
      type: l.type,
      status: l.status,
      title: l.title,
      details: l.details,
      actorName: l.actorName,
      actorRole: l.actorRole,
      relatedTaskTitle: l.relatedTaskTitle,
      actionUrl: l.actionUrl,
      icon: l.icon,
      createdAt: l.createdAt.toISOString(),
      projectTopic: projectMap.get(l.projectId) || "",
      projectId: l.projectId,
    })),
  });
}
