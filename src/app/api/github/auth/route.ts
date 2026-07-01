// NEXUS AI - GET /api/github/auth
// Redirects the user to GitHub's OAuth authorize page.
// Query params: ?projectId=X&token=X (leader token, to verify access)

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const token = url.searchParams.get("token");

  if (!projectId || !token) {
    return Response.json({ error: "projectId and token required" }, { status: 400 });
  }

  // Verify the requester is the leader
  const access = await resolveAccess(projectId, token);
  if (!access || access.role !== "leader") {
    return Response.json({ error: "Leader access required" }, { status: 403 });
  }

  if (!CLIENT_ID) {
    return Response.json({ error: "GITHUB_CLIENT_ID not configured" }, { status: 500 });
  }

  // Build the GitHub authorize URL
  // state = projectId|token so the callback knows which project to save the token to
  const state = `${projectId}|${token}`;
  // Hardcode redirect_uri to localhost:3000 — must match the GitHub OAuth App config
  const redirectUri = `http://localhost:3000/api/github/callback`;
  const scope = "repo";
  const githubAuthUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}`;

  return Response.redirect(githubAuthUrl);
}
