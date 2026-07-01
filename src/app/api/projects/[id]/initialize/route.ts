// NEXUS AI - POST /api/projects/[id]/initialize
// Leader generates the detailed todolist via AI. Runs IN THE BACKGROUND.
// Returns immediately. Frontend polls GET /api/projects/[id]/initialize/progress.

import { db } from "@/lib/db";
import { generateTasks } from "@/lib/ai";
import { resolveAccess, requireLeader } from "@/lib/access";
import { sendTaskAssignedEmail } from "@/lib/email";
import {
  reconstructInput,
  reconstructResult,
} from "@/app/api/projects/_lib/reconstruct";
import {
  initInitialize,
  finishInitialize,
} from "@/lib/pipeline-progress";
import type { TaskItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600;

function parseArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((v) => String(v));
  }
  if (typeof val === "string" && val.trim()) {
    return val
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseDeadline(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val !== "string") return null;
  const s = val.trim();
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
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

    const project = await db.project.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

    const input = await reconstructInput(id);
    if (!input) return Response.json({ error: "Project input not reconstructable" }, { status: 500 });
    const result = await reconstructResult(id);

    // Initialize progress tracker
    initInitialize(id);

    // Run task generation IN THE BACKGROUND
    (async () => {
      let savedCount = 0;
      try {
        console.log(`>> [INIT] Background task generation started for project ${id}`);
        const tasks: TaskItem[] = await generateTasks(input, result, () => {
          /* progress callback — not needed, polling covers it */
        });

        // ===== Persist tasks =====
        const memberByName = new Map<string, string>();
        for (const m of project.members) {
          memberByName.set(m.name.toLowerCase(), m.id);
        }

        const tasksByMember = new Map<
          string,
          { member: { id: string; name: string; email: string; inviteToken: string }; tasks: { title: string; deadline: string | null }[] }
        >();

        for (const t of tasks) {
          const matchedMemberId = t.assigneeName
            ? memberByName.get(t.assigneeName.toLowerCase().trim()) || null
            : null;

          const responsibilities = parseArray(t.responsibilities).join("\n");
          const codeConventions = parseArray(t.codeConventions).join("\n");
          const acceptanceCriteria = parseArray(t.acceptanceCriteria).join("\n");
          const deadlineDate = parseDeadline(t.deadline);

          const created = await db.task.create({
            data: {
              projectId: id,
              memberId: matchedMemberId,
              assigneeName: t.assigneeName || "",
              title: t.title || "Untitled task",
              description: t.description || "",
              role: t.role || "",
              responsibilities,
              codeConventions,
              dependencies: t.dependencies || "",
              acceptanceCriteria,
              deadline: deadlineDate,
              sprintName: t.sprintName || "",
              status: t.status || "todo",
              hours: typeof t.hours === "number" ? t.hours : 8,
              priority: t.priority || "P1",
            },
          });
          savedCount++;

          if (matchedMemberId) {
            const member = project.members.find((m) => m.id === matchedMemberId);
            if (member) {
              if (!tasksByMember.has(member.id)) {
                tasksByMember.set(member.id, {
                  member: {
                    id: member.id,
                    name: member.name,
                    email: member.email,
                    inviteToken: member.inviteToken,
                  },
                  tasks: [],
                });
              }
              tasksByMember.get(member.id)!.tasks.push({
                title: created.title,
                deadline: deadlineDate ? deadlineDate.toISOString().split("T")[0] : null,
              });
            }
          }
        }

        // ===== Send TASK_ASSIGNED emails =====
        for (const [, group] of tasksByMember) {
          try {
            await sendTaskAssignedEmail(id, project.topic, group.member, group.tasks);
          } catch {
            /* non-fatal */
          }
        }

        // ===== Update project status =====
        try {
          await db.project.update({
            where: { id },
            data: { status: "INITIALIZED" },
          });
        } catch {
          /* non-fatal */
        }

        finishInitialize(id, savedCount);
        console.log(`>> [INIT] Background task generation COMPLETED: ${savedCount} tasks`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Task generation failed";
        console.error(`>> [INIT] Background task generation FAILED:`, msg);
        finishInitialize(id, undefined, msg);
      }
    })();

    return Response.json({ started: true });
  } catch (err) {
    return Response.json(
      { error: "Failed to initialize project", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
