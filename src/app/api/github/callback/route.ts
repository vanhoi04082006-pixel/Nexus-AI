// NEXUS AI - GET /api/github/callback
// GitHub redirects here after the user authorizes.
// We exchange the code for an access token, fetch the user's GitHub username,
// store both in the DB, then redirect back to the workspace.

import { db } from "@/lib/db";
import { consumeOauthState, encryptToken } from "@/lib/github-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  try {
    // User denied access
    if (error) {
      return Response.redirect(`${BASE}/?github_error=denied`);
    }

    if (!code || !state) {
      return Response.redirect(`${BASE}/?github_error=missing_params`);
    }

    // FIX: Consume nonce (one-time use) — prevents CSRF + replay attacks
    const ctx = consumeOauthState(state);
    if (!ctx) {
      return Response.redirect(`${BASE}/?github_error=invalid_state`);
    }
    const { projectId, leaderToken } = ctx;

    const wsBase = `${BASE}/?p=${projectId}&token=${leaderToken}`;

    // ===== Exchange code for access token =====
    const redirectUri = `${BASE}/api/github/callback`;
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
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text().catch(() => "");
      console.error("[GitHub callback] Token exchange HTTP error:", tokenResp.status, errText);
      return Response.redirect(`${wsBase}&github_error=token_http_${tokenResp.status}`);
    }

    const tokenData = (await tokenResp.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenData.access_token) {
      console.error("[GitHub callback] No access token:", tokenData.error, tokenData.error_description);
      return Response.redirect(`${wsBase}&github_error=no_token`);
    }
    const accessToken = tokenData.access_token;

    // ===== Fetch GitHub username =====
    const userResp = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "NEXUS-AI",
      },
    });

    if (!userResp.ok) {
      console.error("[GitHub callback] User fetch HTTP error:", userResp.status);
      return Response.redirect(`${wsBase}&github_error=user_http_${userResp.status}`);
    }

    const userData = (await userResp.json()) as { login?: string };
    const githubUsername = userData.login || "";
    if (!githubUsername) {
      console.error("[GitHub callback] No username in user data");
      return Response.redirect(`${wsBase}&github_error=no_username`);
    }

    // ===== Store token + username in DB =====
    // FIX: Encrypt token at rest (was plaintext → DB leak exposes full GitHub access)
    const encryptedToken = encryptToken(accessToken);
    await db.project.update({
      where: { id: projectId },
      data: {
        githubToken: encryptedToken,
        githubUsername,
      },
    });
    console.log(`[GitHub callback] Connected @${githubUsername} to project ${projectId}`);

    // ===== Redirect back to workspace with success flag =====
    return Response.redirect(`${wsBase}&github_connected=1`);
  } catch (err) {
    // Catch-all to prevent HTTP 500 — always redirect back to home with error
    console.error("[GitHub callback] Unexpected error:", err);
    return Response.redirect(`${BASE}/?github_error=unexpected`);
  }
}
