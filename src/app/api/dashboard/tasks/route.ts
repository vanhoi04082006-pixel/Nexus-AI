// NEXUS AI - GET /api/dashboard/tasks
// Returns tasks relevant to the current user across all their projects:
//   - incomplete (not done)
//   - in_progress
//   - due soon (deadline within 24h)
//   - overdue (deadline passed, not done)
//   - assigned to the current user (leader email or member email)
//
// Query: ?token=LEADER_TOKEN&filter=in_progress|overdue|due_soon|assigned|all

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const filter = url.searchParams.get("filter") || "all";

  if (!token) {
    return Response.json({ error: "Token required" }, { status: 401 });
  }

  // Resolve user: leader (by leaderToken) or member (by inviteToken)
  const project = await db.project.findFirst({
    where: { leaderToken: token },
    include: { members: { where: { inviteToken: token } } },
  });
  let userEmail = "";
  let userRole = "";
  let accessibleProjectIds: string[] = [];

  if (project) {
    userEmail = project.leaderEmail || project.leaderName;
    userRole = "leader";
    // Leader sees all their projects
    const allProjects = await db.project.findMany({
      where: { leaderToken: token },
      select: { id: true },
    });
    accessibleProjectIds = allProjects.map((p) => p.id);
  } else {
    // Try member token
    const member = await db.member.findFirst({
      where: { inviteToken: token },
      include: { project: { select: { id: true, leaderEmail: true } } },
    });
    if (member) {
      userEmail = member.email;
      userRole = "member";
      accessibleProjectIds = [member.projectId];
    } else {
      return Response.json({ error: "Invalid token" }, { status: 403 });
    }
  }

  if (accessibleProjectIds.length === 0) {
    return Response.json({ tasks: [], counts: { total: 0, inProgress: 0, overdue: 0, dueSoon: 0, assignedToMe: 0 } });
  }

  // Fetch tasks across all accessible projects
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const where: { projectId: { in: string[] }; [key: string]: unknown } = { projectId: { in: accessibleProjectIds } };
  if (filter === "in_progress") {
    where.status = "in_progress";
  } else if (filter === "overdue") {
    where.status = { not: "done" };
    where.deadline = { lt: now };
  } else if (filter === "due_soon") {
    where.status = { not: "done" };
    where.deadline = { gte: now, lte: in24h };
  } else if (filter === "assigned") {
    // Tasks assigned to the current user (by email match in assigneeName or member.email)
    where.AND = [
      { status: { not: "done" } },
      {
        OR: [
          { assigneeName: { contains: userEmail } },
          { member: { email: userEmail } },
        ],
      },
    ];
  } else {
    // "all" — all incomplete tasks
    where.status = { not: "done" };
  }

  const tasks = await db.task.findMany({
    where,
    orderBy: [{ deadline: "asc" }, { priority: "desc" }],
    take: 50,
    include: {
      member: { select: { name: true, email: true } },
    },
  });

  // Enrich with project topic + computed flags
  const projects = await db.project.findMany({
    where: { id: { in: accessibleProjectIds } },
    select: { id: true, topic: true, leaderToken: true },
  });
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const enriched = tasks.map((t) => {
    const isOverdue = t.deadline && new Date(t.deadline) < now && t.status !== "done";
    const isDueSoon = t.deadline && new Date(t.deadline) >= now && new Date(t.deadline) <= in24h && t.status !== "done";
    const isAssignedToMe =
      t.assigneeName?.toLowerCase().includes(userEmail.toLowerCase()) ||
      t.member?.email?.toLowerCase() === userEmail.toLowerCase();
    // Progress approximation by status (todo=0, in_progress=50, review=80, done=100)
    const progressMap: Record<string, number> = { todo: 0, in_progress: 50, review: 80, done: 100 };
    const progress = progressMap[t.status] ?? 0;
    const p = projectMap.get(t.projectId);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      assigneeName: t.assigneeName,
      memberName: t.member?.name || null,
      memberEmail: t.member?.email || null,
      role: t.role,
      priority: t.priority,
      sprintName: t.sprintName,
      layer: t.layer,
      status: t.status,
      progress,
      deadline: t.deadline?.toISOString() || null,
      isOverdue,
      isDueSoon,
      isAssignedToMe,
      projectId: t.projectId,
      projectTopic: p?.topic || "",
      token: p?.leaderToken || token, // for click-through
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  });

  // Counts (always computed across ALL the user's tasks, regardless of filter)
  const allTasks = await db.task.findMany({
    where: { projectId: { in: accessibleProjectIds } },
    select: { status: true, deadline: true, assigneeName: true, memberId: true, member: { select: { email: true } } },
  });
  const counts = {
    total: allTasks.length,
    inProgress: allTasks.filter((t) => t.status === "in_progress").length,
    overdue: allTasks.filter((t) => t.deadline && new Date(t.deadline) < now && t.status !== "done").length,
    dueSoon: allTasks.filter((t) => t.deadline && new Date(t.deadline) >= now && new Date(t.deadline) <= in24h && t.status !== "done").length,
    assignedToMe: allTasks.filter(
      (t) =>
        t.status !== "done" &&
        (t.assigneeName?.toLowerCase().includes(userEmail.toLowerCase()) ||
          t.member?.email?.toLowerCase() === userEmail.toLowerCase())
    ).length,
  };

  return Response.json({
    tasks: enriched,
    counts,
    userEmail,
    userRole,
  });
}
