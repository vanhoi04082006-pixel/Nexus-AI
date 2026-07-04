// NEXUS AI - GET + POST /api/projects
// GET: List all projects (Home page / project history)
// POST: Create new project + run AI pipeline in background

import { db } from "@/lib/db";
import { runPipeline } from "@/lib/ai";
import { sendInvitationEmails } from "@/lib/email";
import { logActivity, updatePipelineStatus } from "@/lib/activity";
import { SECTION_KEYS } from "@/app/api/projects/_lib/reconstruct";
import {
  initProgress,
  updateAgent,
  finishProgress,
  failProgress,
  appendLog,
  runWithProjectLog,
  getProgress,
} from "@/lib/pipeline-progress";
import type { ProjectInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600;

// ===== GET: List all projects =====
export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        topic: true,
        description: true,
        status: true,
        leaderName: true,
        leaderEmail: true,
        leaderToken: true,
        purpose: true,
        isFavorite: true,
        isArchived: true,
        priority: true,
        deadline: true,
        techStack: true,
        tags: true,
        coverColor: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            members: true,
            tasks: true,
            analyses: true,
          },
        },
        members: {
          select: { id: true, name: true, email: true, role: true },
          take: 8,
        },
        tasks: {
          select: { status: true },
        },
      },
      take: 100,
    });

    return Response.json({
      projects: projects.map((p) => {
        const totalTasks = p.tasks.length;
        const doneTasks = p.tasks.filter((t) => t.status === "done").length;
        const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
        let techStack: string[] = [];
        let tags: string[] = [];
        try { techStack = JSON.parse(p.techStack); } catch { /* keep default */ }
        try { tags = JSON.parse(p.tags); } catch { /* keep default */ }
        return {
          id: p.id,
          topic: p.topic,
          description: p.description,
          status: p.status,
          leaderName: p.leaderName,
          leaderEmail: p.leaderEmail,
          leaderToken: p.leaderToken,
          purpose: p.purpose,
          isFavorite: p.isFavorite,
          isArchived: p.isArchived,
          priority: p.priority,
          deadline: p.deadline?.toISOString() || null,
          techStack,
          tags,
          coverColor: p.coverColor,
          memberCount: p._count.members,
          taskCount: p._count.tasks,
          doneTaskCount: doneTasks,
          totalTaskCount: totalTasks,
          progress,
          hasAnalysis: p._count.analyses > 0,
          members: p.members,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch projects", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}

// ===== POST: Create project + run pipeline =====
export async function POST(req: Request) {
  let input: ProjectInput;
  try {
    input = (await req.json()) as ProjectInput;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ===== Validate =====
  if (!input || !input.topic || !input.topic.trim()) {
    return Response.json({ error: "Topic is required" }, { status: 400 });
  }
  if (!input.members || !Array.isArray(input.members) || input.members.length === 0) {
    return Response.json({ error: "At least one member is required" }, { status: 400 });
  }
  if (!input.leaderName || !input.leaderName.trim()) {
    return Response.json({ error: "Leader name is required" }, { status: 400 });
  }
  if (!input.leaderEmail || !input.leaderEmail.trim()) {
    return Response.json({ error: "Leader email is required (for SMTP)" }, { status: 400 });
  }
  if (!input.leaderSmtpPassword || !input.leaderSmtpPassword.trim()) {
    return Response.json({ error: "Leader SMTP app password is required" }, { status: 400 });
  }

  // ===== Create project =====
  let project;
  try {
    project = await db.project.create({
      data: {
        topic: input.topic.trim(),
        description: input.description || "",
        purpose: input.purpose || "",
        extraInfo: JSON.stringify(input.extraInfo || {}),
        leaderName: input.leaderName.trim(),
        leaderEmail: input.leaderEmail.trim(),
        leaderSmtpPassword: input.leaderSmtpPassword.trim(),
        status: "ANALYZING",
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to create project", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }

  // ===== Create member records =====
  let memberRows: { id: string; name: string; email: string; inviteToken: string }[] = [];
  try {
    for (const m of input.members) {
      const created = await db.member.create({
        data: {
          projectId: project.id,
          name: m.name,
          email: m.email,
          strengths: m.strengths || "",
          weaknesses: m.weaknesses || "",
        },
      });
      memberRows.push({
        id: created.id,
        name: created.name,
        email: created.email,
        inviteToken: created.inviteToken,
      });
    }
  } catch (err) {
    return Response.json(
      { error: "Failed to create members", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }

  // ===== Initialize progress tracker =====
  initProgress(project.id);
  appendLog({
    level: "info",
    provider: "pipeline",
    agentId: "PIPELINE",
    message: `▶ PIPELINE STARTED — topic: "${input.topic}" — ${input.members.length} member(s)`,
  });
  // Mark pipeline as running (for the live dashboard)
  try {
    await updatePipelineStatus(project.id, "running", "Initializing", 5, "ANALYSIS");
  } catch { /* non-fatal */ }

  // ===== Run pipeline IN THE BACKGROUND =====
  process.nextTick(() => {
    console.log(`>> [PIPELINE] Background pipeline started for project ${project.id} (${input.topic})`);
    // Wrap the entire pipeline in runWithProjectLog so all deep callees
    // (openrouter.ts, ai.ts) can append log lines via AsyncLocalStorage.
    runWithProjectLog(project.id, () => {
      runPipeline(input, (ev) => {
        if (ev.type === "agent_start") {
          updateAgent(project.id, ev.id, "running");
        } else if (ev.type === "agent_done") {
          updateAgent(project.id, ev.id, "done");
        } else if (ev.type === "agent_fail") {
          updateAgent(project.id, ev.id, "failed", ev.error);
        }
      })
        .then(async (result) => {
          // Persist all sections
          try {
            for (const key of SECTION_KEYS) {
              const content = (result as unknown as Record<string, unknown>)[key];
              if (content === undefined || content === null) continue;
              const existing = await db.analysis.findUnique({
                where: { projectId_type: { projectId: project.id, type: key } },
              });
              if (existing) {
                await db.analysis.update({
                  where: { id: existing.id },
                  data: { content: JSON.stringify(content), version: { increment: 1 } },
                });
              } else {
                await db.analysis.create({
                  data: { projectId: project.id, type: key, content: JSON.stringify(content) },
                });
              }
            }

            // ===== Save long-term memory (ProjectContext) =====
            // Store compressed summary so AI can "remember" this project
            const summary = {
              topic: input.topic,
              modules: result.analysis?.modules || [],
              techStack: {
                fe: result.analysis?.techStack?.frontend?.name,
                be: result.analysis?.techStack?.backend?.name,
                db: result.analysis?.techStack?.database?.name,
              },
              actors: (result.analysis?.actors || []).map((a) => a.name),
              features: (result.analysis?.features || []).map((f) => f.name),
              members: input.members.map((m) => ({ name: m.name, email: m.email })),
              assignments: (result.hr?.assignments || []).map((a) => ({
                name: a.name,
                role: a.role,
              })),
              sprints: (result.sprint?.sprints || []).map((s) => s.name),
            };

            await db.projectContext.upsert({
              where: { projectId: project.id },
              create: {
                projectId: project.id,
                summary: JSON.stringify(summary),
                fullResults: JSON.stringify(result).substring(0, 50000),
                runCount: 1,
              },
              update: {
                summary: JSON.stringify(summary),
                fullResults: JSON.stringify(result).substring(0, 50000),
                runCount: { increment: 1 },
              },
            });
            console.log(`>> [PIPELINE] Long-term memory saved for project ${project.id}`);
          } catch (err) {
            console.error(`>> [PIPELINE] Failed to save sections/context:`, err);
          }

          // Update project status
          try {
            await db.project.update({ where: { id: project.id }, data: { status: "WORKSPACE" } });
          } catch {
            /* non-fatal */
          }

          // Send invitation emails
          try {
            await sendInvitationEmails(project.id, input.topic, input.leaderName, memberRows);
          } catch (err) {
            console.error(`>> [PIPELINE] Failed to send invitations:`, err);
          }

          finishProgress(project.id, { projectId: project.id, leaderToken: project.leaderToken });
          console.log(`>> [PIPELINE] Background pipeline COMPLETED for project ${project.id}`);
          appendLog({
            level: "success",
            provider: "pipeline",
            agentId: "PIPELINE",
            message: `✅ PIPELINE COMPLETED — all sections saved, invitations sent`,
          });
          // Save activity log (pipeline success = project ready)
          try {
            const p = getProgress(project.id);
            const doneCount = p?.agents.filter((a) => a.status === "done").length || 0;
            const failedCount = p?.agents.filter((a) => a.status === "failed").length || 0;
            const logCount = p?.logs.length || 0;
            await logActivity({
              projectId: project.id,
              type: "PROJECT_CREATED",
              status: "SUCCESS",
              title: `Pipeline hoàn thành — 10 AI Agents`,
              details: `✅ ${doneCount}/10 agents hoàn thành${failedCount > 0 ? `, ${failedCount} fallback` : ""}. Tất cả sections đã lưu. Email lời mời đã gửi ${memberRows.length} thành viên. ${logCount} log lines.`,
              actorName: input.leaderName,
              actorEmail: input.leaderEmail,
              actorRole: "Leader",
              agentId: "PIPELINE",
              logCount,
            });
            await updatePipelineStatus(project.id, "success", "", 100, "DONE");
          } catch { /* non-fatal */ }
        })
        .catch(async (err) => {
          const msg = err instanceof Error ? err.message : "Pipeline failed";
          console.error(`>> [PIPELINE] Background pipeline FAILED:`, msg);
          appendLog({
            level: "error",
            provider: "pipeline",
            agentId: "PIPELINE",
            message: `❌ PIPELINE FAILED — ${msg}`,
          });
          // Save activity log (pipeline failure = project creation failed)
          try {
            await logActivity({
              projectId: project.id,
              type: "AI_AGENT_ERROR",
              status: "FAILED",
              title: `Pipeline thất bại`,
              details: `❌ Lỗi: ${msg}. Kiểm tra Live Log Console để xem chi tiết model nào fail.`,
              actorName: input.leaderName,
              actorEmail: input.leaderEmail,
              actorRole: "Leader",
              agentId: "PIPELINE",
            });
            await updatePipelineStatus(project.id, "failed", "", 0, "PIPELINE", msg);
          } catch { /* non-fatal */ }
          failProgress(project.id, msg);
        });
    });
  });

  // ===== Return immediately so the client can start polling =====
  return Response.json({
    projectId: project.id,
    leaderToken: project.leaderToken,
  });
}
