// NEXUS AI - GET /api/github/callback
// GitHub redirects here after the user authorizes.
// We exchange the code for an access token, fetch the user's GitHub username,
// store both in the DB, then redirect back to the workspace.

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // User denied access
  if (error) {
    return Response.redirect(`/?github_error=denied`);
  }

  if (!code || !state) {
    return Response.redirect(`/?github_error=missing_params`);
  }

  // state = projectId|leaderToken
  const [projectId, leaderToken] = state.split("|");
  if (!projectId || !leaderToken) {
    return Response.redirect(`/?github_error=invalid_state`);
  }

  // ===== Exchange code for access token =====
  let accessToken: string;
  try {
    const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenResp.ok) {
      throw new Error(`Token exchange failed: HTTP ${tokenResp.status}`);
    }

    const tokenData = (await tokenResp.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "No access token");
    }
    accessToken = tokenData.access_token;
  } catch (err) {
    console.error("[GitHub callback] Token exchange error:", err);
    return Response.redirect(
      `/?p=${projectId}&token=${leaderToken}&github_error=token_exchange`
    );
  }

  // ===== Fetch GitHub username =====
  let githubUsername: string;
  try {
    const userResp = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "NEXUS-AI",
      },
    });

    if (!userResp.ok) {
      throw new Error(`User fetch failed: HTTP ${userResp.status}`);
    }

    const userData = (await userResp.json()) as { login?: string };
    githubUsername = userData.login || "";
    if (!githubUsername) throw new Error("No username in user data");
  } catch (err) {
    console.error("[GitHub callback] User fetch error:", err);
    return Response.redirect(
      `/?p=${projectId}&token=${leaderToken}&github_error=user_fetch`
    );
  }

  // ===== Store token + username in DB =====
  try {
    await db.project.update({
      where: { id: projectId },
      data: {
        githubToken: accessToken,
        githubUsername,
      },
    });
    console.log(`[GitHub callback] Connected @${githubUsername} to project ${projectId}`);
  } catch (err) {
    console.error("[GitHub callback] DB save error:", err);
    return Response.redirect(
      `/?p=${projectId}&token=${leaderToken}&github_error=db_save`
    );
  }

  // ===== Redirect back to workspace with success flag =====
  return Response.redirect(
    `/?p=${projectId}&token=${leaderToken}&github_connected=1`
  );
}
