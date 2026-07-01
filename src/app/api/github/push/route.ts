// NEXUS AI - POST /api/github/push
// Pushes the generated project files to GitHub.
// Query: ?token=X&projectId=X (leader token)

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";
import { pushProjectToGitHub } from "@/lib/github";

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
    return Response.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[GitHub push] Error:", err);
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Push failed",
      },
      { status: 500 }
    );
  }
}
