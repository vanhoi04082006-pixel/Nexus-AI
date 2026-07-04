// NEXUS AI - POST /api/github/push
// Pushes the generated project files to GitHub.
// Query: ?token=X&projectId=X (leader token)

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";
import { pushProjectToGitHub } from "@/lib/github";
import { logActivity, updatePipelineStatus } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const projectId = url.searchParams.get("projectId");

  if (!token || !projectId) {
    return Response.json({ error: "token and projectId required" }, { status: 400 });
  }

  const access = await resolveAccess(projectId, token);
  if (!requireLeader(access)) {
    return Response.json({ error: "Leader access required" }, { status: 403 });
  }

  try {
    const result = await pushProjectToGitHub(projectId);
    // Log successful deploy + mark pipeline as deploying → success
    try {
      await updatePipelineStatus(projectId, "deploying", "Git / DevOps", 90, "DEPLOY");
      await logActivity({
        projectId,
        type: "DEPLOY",
        status: "SUCCESS",
        title: `Push lên GitHub`,
        details: `${result.repoName} (${result.fileCount} files, commit ${result.commitSha.substring(0, 7)}${result.prUrl ? `, PR: ${result.prUrl}` : ""})`,
        actorName: access?.name || "Leader",
        actorEmail: access?.email,
        actorRole: "Leader",
        actionUrl: result.repoUrl,
        actionLabel: "Mở Repo",
      });
      await updatePipelineStatus(projectId, "success", "Git / DevOps", 100, "DEPLOY");
    } catch { /* non-fatal */ }
    return Response.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[GitHub push] Error:", err);
    // Log failed deploy
    try {
      const errMsg = err instanceof Error ? err.message : "Push failed";
      await logActivity({
        projectId,
        type: "DEPLOY",
        status: "FAILED",
        title: `Push lên GitHub thất bại`,
        details: errMsg,
        actorName: access?.name || "Leader",
        actorEmail: access?.email,
        actorRole: "Leader",
      });
      await updatePipelineStatus(projectId, "failed", "Git / DevOps", 0, "DEPLOY", errMsg);
    } catch { /* non-fatal */ }
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Push failed",
      },
      { status: 500 }
    );
  }
}
