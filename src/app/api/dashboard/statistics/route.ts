// NEXUS AI - GET /api/dashboard/statistics
// Returns aggregate dashboard statistics across all projects the current user owns.
//   - totalProjects, activeProjects, completedProjects
//   - totalMembers, totalTasks, completedTasks
//   - overallCompletionRate
//   - perProject: [{ projectId, topic, totalTasks, doneTasks, completionRate, status }]
//   - recentActivityCount (last 24h)

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return Response.json({ error: "Token required" }, { status: 401 });
  }

  const projects = await db.project.findMany({
    where: { leaderToken: token },
    select: {
      id: true,
      topic: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { members: true, tasks: true } },
    },
  });

  if (projects.length === 0) {
    return Response.json({
      totalProjects: 0,
      activeProjects: 0,
      completedProjects: 0,
      totalMembers: 0,
      totalTasks: 0,
      completedTasks: 0,
      overallCompletionRate: 0,
      perProject: [],
      recentActivityCount: 0,
    });
  }

  const projectIds = projects.map((p) => p.id);

  // Task stats per project
  const taskStats = await db.task.groupBy({
    by: ["projectId", "status"],
    where: { projectId: { in: projectIds } },
    _count: { _all: true },
  });

  // Build per-project stats
  const perProject = projects.map((p) => {
    const stats = taskStats.filter((t) => t.projectId === p.id);
    const totalTasks = stats.reduce((sum, s) => sum + s._count._all, 0);
    const doneTasks = stats.filter((s) => s.status === "done").reduce((sum, s) => sum + s._count._all, 0);
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    return {
      projectId: p.id,
      topic: p.topic,
      status: p.status,
      memberCount: p._count.members,
      totalTasks,
      doneTasks,
      completionRate,
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === "WORKSPACE" || p.status === "ANALYZING").length;
  const completedProjects = projects.filter((p) => p.status === "INITIALIZED").length;
  const totalMembers = projects.reduce((sum, p) => sum + p._count.members, 0);
  const totalTasks = perProject.reduce((sum, p) => sum + p.totalTasks, 0);
  const completedTasks = perProject.reduce((sum, p) => sum + p.doneTasks, 0);
  const overallCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Recent activity count (last 24h)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentActivityCount = await db.activityLog.count({
    where: { projectId: { in: projectIds }, createdAt: { gte: yesterday } },
  });

  return Response.json({
    totalProjects,
    activeProjects,
    completedProjects,
    totalMembers,
    totalTasks,
    completedTasks,
    overallCompletionRate,
    perProject,
    recentActivityCount,
  });
}
