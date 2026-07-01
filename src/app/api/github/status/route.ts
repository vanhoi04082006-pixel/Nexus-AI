// NEXUS AI - GET /api/github/status
// Returns the GitHub connection status for a project.
// Query: ?token=X&projectId=X

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
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

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      githubToken: true,
      githubUsername: true,
      githubRepoName: true,
      githubPushedAt: true,
    },
  });

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  return Response.json({
    connected: !!project.githubToken,
    username: project.githubUsername || null,
    repoName: project.githubRepoName || null,
    pushedAt: project.githubPushedAt?.toISOString() || null,
  });
}
