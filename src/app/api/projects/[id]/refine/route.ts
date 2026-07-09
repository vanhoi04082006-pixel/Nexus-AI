// NEXUS AI - POST /api/projects/[id]/refine
// Leader triggers AI re-generation of all sections. Runs IN THE BACKGROUND.
// Returns immediately. Frontend polls GET /api/projects/[id]/refine/progress.

import { db } from "@/lib/db";
import { refineSections } from "@/lib/ai";
import { resolveAccess, requireLeader } from "@/lib/access";
import {
  logActivity,
  updateAgentStatus,
  updatePipelineStatus,
} from "@/lib/activity";
import {
  reconstructInput,
  reconstructResult,
  SECTION_KEYS,
} from "@/app/api/projects/_lib/reconstruct";
import {
  initRefine,
  updateRefineSection,
  finishRefine,
  getRefine,
  appendLog,
  runWithRefineLog,
} from "@/lib/pipeline-progress";
import type { LogEntry } from "@/lib/pipeline-progress";
import type { SectionType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600;

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

    const body = (await req.json()) as {
      editRequests: { section: SectionType; change: string }[];
      chatDiscussion: string;
    };

    if (!body || !Array.isArray(body.editRequests)) {
      return Response.json({ error: "editRequests array is required" }, { status: 400 });
    }

    const input = await reconstructInput(id);
    if (!input) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }
    const current = await reconstructResult(id);

    // Initialize progress tracker
    initRefine(id);
    appendLog({
      level: "info",
      agentId: "REFINE",
      provider: "pipeline",
      message: `▶ REFINE STARTED — ${body.editRequests.length} edit request(s)`,
    });

    // Mark pipeline as running + AI agent busy (for the live dashboard)
    try {
      await updatePipelineStatus(id, "running", "AI Refine", 10, "REFINE");
      await updateAgentStatus("REFINE", "AI Refine", "Section Refiner", "busy", `Refining ${body.editRequests.length} section(s)`, id);
    } catch { /* non-fatal */ }

    // Run refine IN THE BACKGROUND, wrapped in runWithRefineLog so all
    // log calls land in refineMap.
    runWithRefineLog(id, () => {
      (async () => {
        try {
          console.log(`>> [REFINE] Background refine started for project ${id}`);
          const refined = await refineSections(
            input,
            current,
            body.editRequests,
            body.chatDiscussion || "",
            (section: SectionType, done: boolean) => {
              updateRefineSection(id, section, done);
            }
          );

          appendLog({
            level: "info",
            agentId: "REFINE",
            provider: "pipeline",
            message: `💾 Đang lưu ${SECTION_KEYS.length} section vào database...`,
          });

          // Persist all refined sections (bump version)
          for (const key of SECTION_KEYS) {
            const content = (refined as unknown as Record<string, unknown>)[key];
            if (content === undefined || content === null) continue;
            const existing = await db.analysis.findUnique({
              where: { projectId_type: { projectId: id, type: key } },
            });
            if (existing) {
              await db.analysis.update({
                where: { id: existing.id },
                data: {
                  content: JSON.stringify(content),
                  version: { increment: 1 },
                },
              });
            } else {
              await db.analysis.create({
                data: {
                  projectId: id,
                  type: key,
                  content: JSON.stringify(content),
                },
              });
            }
          }

          finishRefine(id);
          console.log(`>> [REFINE] Background refine COMPLETED for project ${id}`);
          appendLog({
            level: "success",
            agentId: "REFINE",
            provider: "pipeline",
            message: `✅ REFINE COMPLETED — tất cả section đã lưu (version bumped)`,
          });
          // FIX: Capture full refine logs (for HistoryTab detail modal)
          const refineLogs = getRefine(id);
          const refineLogCount = refineLogs?.logs?.length || 0;
          const fullRefineLogs = refineLogs?.logs?.length
            ? refineLogs.logs.map((l: LogEntry) => {
                const time = new Date(l.ts).toLocaleTimeString("vi-VN");
                const level = l.level.toUpperCase().padEnd(7);
                const model = l.model ? ` [${l.model.substring(0, 30)}]` : "";
                const keyIdx = l.keyIndex != null ? ` Key#${l.keyIndex}` : "";
                return `${time} ${level}${model}${keyIdx} ${l.message}`;
              }).join("\n")
            : "";
          // Mark AI agent as online again + pipeline as success
          try {
            await updateAgentStatus("REFINE", "AI Refine", "Section Refiner", "online", "Idle", id);
            await updatePipelineStatus(id, "success", "AI Refine", 100, "REFINE");
          } catch { /* non-fatal */ }
          // Save activity log — FIX: include full logs
          try {
            const summary = `✅ Đã sinh lại tất cả 9 sections (Analysis, HR, Sprint, Design, UML, Docs, Git, Test, Security). Version bumped trong database. ${body.editRequests.length} edit request(s) + chat discussion đã được áp dụng.`;
            await logActivity({
              projectId: id,
              type: "AI_AGENT_DONE",
              status: "SUCCESS",
              title: `AI Refine thành công`,
              details: `${summary}\n\n═══════════════════════════════════════════\nLIVE LOG (${refineLogCount} lines):\n═══════════════════════════════════════════\n${fullRefineLogs}`,
              actorName: "AI Refine",
              actorRole: "AI Agent",
              agentId: "REFINE",
              logCount: refineLogCount,
            });
          } catch { /* non-fatal */ }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Refine failed";
          console.error(`>> [REFINE] Background refine FAILED:`, msg);
          appendLog({
            level: "error",
            agentId: "REFINE",
            provider: "pipeline",
            message: `❌ REFINE FAILED — ${msg}`,
          });
          // FIX: Capture full refine logs (for HistoryTab)
          const refineErrLogs = getRefine(id);
          const refineErrLogCount = refineErrLogs?.logs?.length || 0;
          const fullRefineErrLogs = refineErrLogs?.logs?.length
            ? refineErrLogs.logs.map((l: LogEntry) => {
                const time = new Date(l.ts).toLocaleTimeString("vi-VN");
                const level = l.level.toUpperCase().padEnd(7);
                const model = l.model ? ` [${l.model.substring(0, 30)}]` : "";
                const keyIdx = l.keyIndex != null ? ` Key#${l.keyIndex}` : "";
                return `${time} ${level}${model}${keyIdx} ${l.message}`;
              }).join("\n")
            : "";
          // Mark AI agent as error + pipeline as failed
          try {
            await updateAgentStatus("REFINE", "AI Refine", "Section Refiner", "error", `Failed: ${msg}`, id);
            await updatePipelineStatus(id, "failed", "AI Refine", 0, "REFINE", msg);
          } catch { /* non-fatal */ }
          // Save activity log — FIX: include full logs
          try {
            await logActivity({
              projectId: id,
              type: "AI_AGENT_ERROR",
              status: "FAILED",
              title: `AI Refine thất bại`,
              details: `❌ Lỗi: ${msg}\n\n═══════════════════════════════════════════\nLIVE LOG (${refineErrLogCount} lines):\n═══════════════════════════════════════════\n${fullRefineErrLogs}`,
              actorName: "AI Refine",
              actorRole: "AI Agent",
              agentId: "REFINE",
              logCount: refineErrLogCount,
            });
          } catch { /* non-fatal */ }
          finishRefine(id, msg);
        }
      })();
    });

    return Response.json({ started: true });
  } catch (err) {
    return Response.json(
      { error: "Failed to start refine", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
