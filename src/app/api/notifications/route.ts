// NEXUS AI - GET /api/notifications
// Returns all notifications across all projects for the current user (leader token)
// Query: ?token=LEADER_TOKEN

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return Response.json({ error: "Token required" }, { status: 401 });

  // Find all projects where this token is the leader
  const projects = await db.project.findMany({
    where: { leaderToken: token },
    select: { id: true, topic: true },
  });
  const projectIds = projects.map((p) => p.id);
  if (projectIds.length === 0) return Response.json({ notifications: [], unread: 0 });

  const notifications = await db.notification.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unread = notifications.filter((n) => !n.read).length;

  // Enrich with project topic
  const projectMap = new Map(projects.map((p) => [p.id, p.topic]));
  const enriched = notifications.map((n) => ({
    ...n,
    projectTopic: projectMap.get(n.projectId) || "",
  }));

  return Response.json({ notifications: enriched, unread });
}
