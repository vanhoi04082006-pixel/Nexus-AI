// NEXUS AI - POST /api/projects
// Creates a new project, kicks off the multi-agent pipeline IN THE BACKGROUND,
// and returns immediately with { projectId, leaderToken }.
// The frontend polls GET /api/projects/[id]/progress for live status.
// This replaces SSE streaming — polling is robust through proxies/gateways.

import { db } from "@/lib/db";
import { runPipeline } from "@/lib/ai";
import { sendInvitationEmails } from "@/lib/email";
import { SECTION_KEYS } from "@/app/api/projects/_lib/reconstruct";
import {
  initProgress,
  updateAgent,
  finishProgress,
  failProgress,
} from "@/lib/pipeline-progress";
import type { ProjectInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600;

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

  // ===== Run pipeline IN THE BACKGROUND =====
  // Use process.nextTick so the response returns first, then pipeline runs.
  // .catch() ensures any crash is handled without killing the server.
  process.nextTick(() => {
    console.log(`>> [PIPELINE] Background pipeline started for project ${project.id} (${input.topic})`);
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
        } catch (err) {
          console.error(`>> [PIPELINE] Failed to save sections:`, err);
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
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Pipeline failed";
        console.error(`>> [PIPELINE] Background pipeline FAILED:`, msg);
        failProgress(project.id, msg);
      });
  });

  // ===== Return immediately so the client can start polling =====
  return Response.json({
    projectId: project.id,
    leaderToken: project.leaderToken,
  });
}
