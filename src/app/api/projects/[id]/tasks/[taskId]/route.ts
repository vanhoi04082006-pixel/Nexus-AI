// NEXUS AI - PUT /api/projects/[id]/tasks/[taskId]
// Updates a task status. Leader can update any task;
// members can update only their own tasks.

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_STATUSES = ["todo", "in_progress", "review", "done"];

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id, taskId } = await params;
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    const access = await resolveAccess(id, token);
    if (!access) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = (await req.json()) as { status: string };
    if (!body || typeof body.status !== "string" || !VALID_STATUSES.includes(body.status)) {
      return Response.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const task = await db.task.findUnique({
      where: { id: taskId },
    });
    if (!task || task.projectId !== id) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    // Permission check: leader can update any; member can update only their own.
    if (access.role === "member") {
      if (!access.memberId || task.memberId !== access.memberId) {
        return Response.json(
          { error: "You can only update your own tasks" },
          { status: 403 }
        );
      }
    }

    const updated = await db.task.update({
      where: { id: taskId },
      data: { status: body.status },
      include: { member: true },
    });

    const project = await db.project.findUnique({
      where: { id },
      select: { topic: true, leaderEmail: true },
    });

    // Create + broadcast notification on task status change
    const isDone = body.status === "done";
    await createNotification({
      projectId: id,
      type: isDone ? "TASK_COMPLETED" : "TASK_STATUS_CHANGED",
      title: isDone
        ? `${access.name} đã hoàn thành task`
        : `${access.name} đổi trạng thái task → ${body.status}`,
      message: `"${updated.title}" trong dự án ${project?.topic || ""}`,
      senderName: access.name,
      senderRole: access.role === "leader" ? "Leader" : (updated.member?.role || "Member"),
      // Notify the leader (project owner) when a member changes a task
      recipientEmail: access.role === "member" ? (project?.leaderEmail || null) : null,
      priority: isDone ? "normal" : "low",
      relatedTaskId: taskId,
      relatedTaskTitle: updated.title,
      actionUrl: `/?p=${id}&token=${token}&tab=tasks`,
      actionLabel: "Mở Task",
      extra: { oldStatus: task.status, newStatus: body.status },
    });

    return Response.json({
      task: {
        id: updated.id,
        assigneeName: updated.assigneeName,
        memberId: updated.memberId,
        memberName: updated.member?.name || null,
        title: updated.title,
        description: updated.description,
        role: updated.role,
        responsibilities: updated.responsibilities,
        codeConventions: updated.codeConventions,
        dependencies: updated.dependencies,
        acceptanceCriteria: updated.acceptanceCriteria,
        deadline: updated.deadline,
        sprintName: updated.sprintName,
        status: updated.status,
        hours: updated.hours,
        priority: updated.priority,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to update task", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
