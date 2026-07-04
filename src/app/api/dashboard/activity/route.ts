// NEXUS AI - GET /api/dashboard/activity
// Returns recent ActivityLog entries across ALL projects the current user can access.
// Query: ?token=LEADER_TOKEN&limit=20&projectId=FILTER (optional)
//
// The leader token resolves to all projects they own. Each activity includes
// project topic + related task title so the dashboard can render rich rows.

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
  const projectIdFilter = url.searchParams.get("projectId");

  if (!token) {
    return Response.json({ error: "Token required" }, { status: 401 });
  }

  // Find all projects where this token is the leader
  const projects = await db.project.findMany({
    where: { leaderToken: token },
    select: { id: true, topic: true, leaderToken: true },
  });
  const projectIds = projects.map((p) => p.id);
  if (projectIds.length === 0) {
    return Response.json({ activities: [] });
  }

  const where = {
    projectId: projectIdFilter && projectIds.includes(projectIdFilter) ? projectIdFilter : { in: projectIds },
  };

  const logs = await db.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const projectMap = new Map(projects.map((p) => [p.id, p.topic]));
  const activities = logs.map((l) => ({
    id: l.id,
    type: l.type,
    status: l.status,
    title: l.title,
    details: l.details,
    actorName: l.actorName,
    actorEmail: l.actorEmail,
    actorRole: l.actorRole,
    actorAvatar: l.actorAvatar,
    relatedTaskId: l.relatedTaskId,
    relatedTaskTitle: l.relatedTaskTitle,
    actionUrl: l.actionUrl,
    actionLabel: l.actionLabel,
    icon: l.icon,
    projectId: l.projectId,
    projectTopic: projectMap.get(l.projectId) || "",
    createdAt: l.createdAt.toISOString(),
  }));

  return Response.json({ activities });
}
