// NEXUS AI - POST /api/projects/[id]/initialize
// Leader generates the detailed todolist via AI. Runs IN THE BACKGROUND.
// Returns immediately. Frontend polls GET /api/projects/[id]/initialize/progress.

import { db } from "@/lib/db";
import { generateTasks } from "@/lib/ai";
import { resolveAccess, requireLeader } from "@/lib/access";
import { sendTaskAssignedEmail } from "@/lib/email";
import {
  logActivity,
  updateAgentStatus,
  updatePipelineStatus,
  refreshTaskStatistics,
} from "@/lib/activity";
import {
  reconstructInput,
  reconstructResult,
} from "@/app/api/projects/_lib/reconstruct";
import {
  initInitialize,
  finishInitialize,
  appendLog,
  runWithInitLog,
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

    // Delete old tasks first (clean slate — fixes "stale tasks" issue)
    await db.task.deleteMany({ where: { projectId: id } });

    // Initialize progress tracker BEFORE starting background task
    // This ensures the progress endpoint returns "running" immediately
    initInitialize(id);
    appendLog({
      level: "info",
      agentId: "TASK",
      provider: "pipeline",
      message: `▶ INIT STARTED — project: "${project.topic}" — ${input.members.length} member(s)`,
    });

    // Mark pipeline as running + AI agent busy (for the live dashboard)
    try {
      await updatePipelineStatus(id, "running", "Sprint Planner", 10, "TASK_GEN");
      await updateAgentStatus("TASK", "Sprint Planner", "Task Generator", "busy", "Generating todolist from sprint plan", id);
    } catch { /* non-fatal */ }

    // Small delay to ensure progress tracker is visible to polling
    await new Promise((r) => setTimeout(r, 100));

    // Run task generation IN THE BACKGROUND
    process.nextTick(() => {
      console.log(`>> [INIT] Background task generation started for project ${id}`);
      let savedCount = 0;

      // Wrap the entire generation in runWithInitLog so all log calls land in initMap
      runWithInitLog(id, () => {
        generateTasks(input, result, () => {
          /* progress callback */
        })
          .then(async (tasks: TaskItem[]) => {
            appendLog({
              level: "info",
              agentId: "TASK",
              provider: "pipeline",
              message: `─────────────────────────────────────────────`,
            });
            appendLog({
              level: "info",
              agentId: "TASK",
              provider: "pipeline",
              message: `💾 Đang lưu ${tasks.length} task vào database...`,
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
              const implementationSteps = parseArray((t as Record<string, unknown>).implementationSteps).join("\n");
              const technicalHints = JSON.stringify((t as Record<string, unknown>).technicalHints || {});

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
                  layer: (t as Record<string, unknown>).layer as string || "BACKEND",
                  targetFile: (t as Record<string, unknown>).targetFile as string || "",
                  implementationSteps,
                  technicalHints,
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

            appendLog({
              level: "info",
              agentId: "TASK",
              provider: "pipeline",
              message: `📧 Đang gửi ${tasksByMember.size} email thông báo task cho thành viên...`,
            });
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
            appendLog({
              level: "success",
              agentId: "TASK",
              provider: "pipeline",
              message: `✅ INIT COMPLETED — ${savedCount} task(s) đã lưu, email đã gửi`,
            });
            // Refresh cached task statistics for the dashboard
            try { await refreshTaskStatistics(id); } catch { /* non-fatal */ }
            // Mark AI agent as online again + pipeline as success
            try {
              await updateAgentStatus("TASK", "Sprint Planner", "Task Generator", "online", "Idle", id);
              await updatePipelineStatus(id, "success", "Sprint Planner", 100, "TASK_GEN");
            } catch { /* non-fatal */ }
            // Save activity logs: SPRINT_CREATED + TASK_CREATED + INIT done
            try {
              await logActivity({
                projectId: id,
                type: "SPRINT_CREATED",
                status: "SUCCESS",
                title: `Sprint được tạo`,
                details: `Sprint plan đã được áp dụng cho ${savedCount} task.`,
                actorName: "Sprint Planner",
                actorRole: "AI Agent",
                agentId: "TASK",
              });
              await logActivity({
                projectId: id,
                type: "TASK_CREATED",
                status: "SUCCESS",
                title: `${savedCount} tasks được tạo`,
                details: `${savedCount} task đã lưu vào database. Email thông báo đã gửi ${tasksByMember.size} thành viên.`,
                actorName: "Sprint Planner",
                actorRole: "AI Agent",
                agentId: "TASK",
              });
              await logActivity({
                projectId: id,
                type: "AI_AGENT_DONE",
                status: "SUCCESS",
                title: `Sinh todolist thành công`,
                details: `✅ ${savedCount} task đã lưu vào database. Email thông báo đã gửi ${tasksByMember.size} thành viên. Tasks phân bổ theo vai trò: ${input.members.map((m) => `${m.name}(${tasks.filter((t) => t.assigneeName === m.name).length})`).join(", ")}`,
                actorName: "Sprint Planner",
                actorRole: "AI Agent",
                agentId: "TASK",
              });
            } catch { /* non-fatal */ }
          })
          .catch(async (err) => {
            const msg = err instanceof Error ? err.message : "Task generation failed";
            console.error(`>> [INIT] Background task generation FAILED:`, msg);
            appendLog({
              level: "error",
              agentId: "TASK",
              provider: "pipeline",
              message: `❌ INIT FAILED — ${msg}`,
            });
            // Mark AI agent as error + pipeline as failed (for the live dashboard)
            try {
              await updateAgentStatus("TASK", "Sprint Planner", "Task Generator", "error", `Failed: ${msg}`, id);
              await updatePipelineStatus(id, "failed", "Sprint Planner", 0, "TASK_GEN", msg);
            } catch { /* non-fatal */ }
            // Save activity log (AI agent error)
            try {
              await logActivity({
                projectId: id,
                type: "AI_AGENT_ERROR",
                status: "FAILED",
                title: `Sinh todolist thất bại`,
                details: `❌ Lỗi: ${msg}. Kiểm tra Live Log Console để xem chi tiết model nào fail.`,
                actorName: "Sprint Planner",
                actorRole: "AI Agent",
                agentId: "TASK",
              });
            } catch { /* non-fatal */ }
            finishInitialize(id, undefined, msg);
          });
      });
    });

    return Response.json({ started: true });
  } catch (err) {
    return Response.json(
      { error: "Failed to initialize project", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
