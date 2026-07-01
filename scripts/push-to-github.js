#!/usr/bin/env node
// NEXUS AI - GitHub Push Script (Device Flow)
// Tự động lấy token qua GitHub OAuth Device Flow (không cần PAT)
// Sau đó push toàn bộ code NEXUS AI lên repo vanhoi04082006-pixel/Nexus-AI

const CLIENT_ID = "Ov23limaVkdJIe0wnYvU";
const CLIENT_SECRET = "5a67ce33225a7ce773095b0e156f7cbe995bd1d5";
const REPO_OWNER = "vanhoi04082006-pixel";
const REPO_NAME = "Nexus-AI";
const GITHUB_API = "https://api.github.com";

const fs = require("fs");
const path = require("path");

async function ghFetch(url, options = {}) {
  const resp = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "NEXUS-AI-Push",
      ...(options.headers || {}),
    },
  });
  return resp;
}

/* ===========================================================
   Step 1: Device Flow — request device code
=========================================================== */
async function requestDeviceCode() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║   NEXUS AI — GitHub Device Flow Authentication      ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const resp = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "NEXUS-AI-Push",
    },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: "repo" }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Device code request failed: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  return data;
}

/* ===========================================================
   Step 2: Poll for access token
=========================================================== */
async function pollForToken(deviceCode, interval, expiresIn) {
  const startTime = Date.now();
  const timeoutMs = expiresIn * 1000;

  console.log("⏳ Đang chờ bạn authorize...\n");

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((r) => setTimeout(r, interval * 1000));

    const resp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "NEXUS-AI-Push",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    const data = await resp.json();

    if (data.access_token) {
      return data.access_token;
    }

    if (data.error === "authorization_pending") {
      process.stdout.write(".");
      continue;
    }

    if (data.error === "slow_down") {
      interval += 5;
      continue;
    }

    if (data.error === "expired_token") {
      throw new Error("Device code đã hết hạn. Chạy lại script.");
    }

    if (data.error === "access_denied") {
      throw new Error("Bạn đã từ chối authorize.");
    }

    throw new Error(`OAuth error: ${data.error} — ${data.error_description || ""}`);
  }

  throw new Error("Timeout — device code hết hạn.");
}

/* ===========================================================
   Step 3: Get authenticated user info
=========================================================== */
async function getUserInfo(token) {
  const resp = await ghFetch(`${GITHUB_API}/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Failed to get user info: ${resp.status}`);
  return resp.json();
}

/* ===========================================================
   Step 4: Create repo (if not exists)
=========================================================== */
async function ensureRepo(token, owner, name) {
  const checkResp = await ghFetch(`${GITHUB_API}/repos/${owner}/${name}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (checkResp.ok) {
    const repo = await checkResp.json();
    console.log(`✓ Repo đã tồn tại: ${repo.full_name}`);
    return repo;
  }

  console.log(`📦 Đang tạo repo ${owner}/${name}...`);
  const createResp = await ghFetch(`${GITHUB_API}/user/repos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description: "NEXUS AI — Multi-Agent Project Architect (8 AI Agents)",
      private: false,
      auto_init: true,
    }),
  });

  if (!createResp.ok) {
    const err = await createResp.json();
    throw new Error(`Failed to create repo: ${err.message || createResp.status}`);
  }

  const repo = await createResp.json();
  console.log(`✓ Đã tạo repo: ${repo.full_name}`);
  return repo;
}

/* ===========================================================
   Step 5: Collect all files from the project
=========================================================== */
function collectFiles(dir, base = dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(base, fullPath);

    if (
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === ".git" ||
      entry.name === "dist" ||
      entry.name === "build" ||
      entry.name === "dev.log" ||
      entry.name === "chat-service.log" ||
      entry.name === "agent-ctx" ||
      entry.name === "tool-results" ||
      entry.name === "bun.lock"
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, base));
    } else if (entry.isFile()) {
      if (entry.name === ".env" || entry.name === ".env.local") continue;
      files.push(relPath);
    }
  }

  return files;
}

function readFiles(filePaths, baseDir) {
  const results = [];
  for (const relPath of filePaths) {
    const fullPath = path.join(baseDir, relPath);
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      results.push({ path: relPath.replace(/\\/g, "/"), content });
    } catch (e) {
      console.log(`  ⚠ Skip (binary): ${relPath}`);
    }
  }
  return results;
}

/* ===========================================================
   Step 6: Push files via Git Data API
=========================================================== */
async function pushFiles(token, owner, repo, files) {
  const refResp = await ghFetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/main`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let parentSha = null;
  let baseTreeSha = null;

  if (refResp.ok) {
    const ref = await refResp.json();
    parentSha = ref.object.sha;

    const commitResp = await ghFetch(`${GITHUB_API}/repos/${owner}/${repo}/git/commits/${parentSha}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (commitResp.ok) {
      const commit = await commitResp.json();
      baseTreeSha = commit.tree.sha;
    }
  }

  console.log(`📝 Đang tạo ${files.length} blobs...`);
  const treeEntries = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const blobResp = await ghFetch(`${GITHUB_API}/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: f.content, encoding: "utf-8" }),
    });

    if (!blobResp.ok) {
      throw new Error(`Failed to create blob for ${f.path}: ${blobResp.status}`);
    }

    const blob = await blobResp.json();
    treeEntries.push({
      path: f.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });

    if ((i + 1) % 20 === 0) {
      console.log(`  ${i + 1}/${files.length} blobs...`);
    }
  }
  console.log(`  ✓ ${files.length} blobs created`);

  console.log("🌳 Đang tạo tree...");
  const treeBody = { tree: treeEntries };
  if (baseTreeSha) treeBody.base_tree = baseTreeSha;

  const treeResp = await ghFetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(treeBody),
  });

  if (!treeResp.ok) {
    const err = await treeResp.json();
    throw new Error(`Failed to create tree: ${err.message || treeResp.status}`);
  }

  const tree = await treeResp.json();

  console.log("💾 Đang tạo commit...");
  const commitBody = {
    message: "NEXUS AI: Initial commit — Multi-Agent Project Architect\n\n8 AI Agents:\n- Requirement Analyst\n- HR Planner\n- Sprint Planner\n- System Architect\n- UML Generator\n- Technical Writer\n- Git/DevOps\n- Quality Reviewer\n\nFeatures:\n- Multi-agent AI pipeline (OpenRouter)\n- Real-time chat (Socket.io)\n- GitHub OAuth integration\n- Todolist with code conventions\n- Mermaid UML diagrams",
    tree: tree.sha,
  };
  if (parentSha) commitBody.parents = [parentSha];

  const commitResp = await ghFetch(`${GITHUB_API}/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commitBody),
  });

  if (!commitResp.ok) {
    const err = await commitResp.json();
    throw new Error(`Failed to create commit: ${err.message || commitResp.status}`);
  }

  const commit = await commitResp.json();

  console.log("🚀 Đang push lên main...");
  const refUpdateResp = await ghFetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/main`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sha: commit.sha }),
    }
  );

  if (!refUpdateResp.ok) {
    const err = await refUpdateResp.json();
    throw new Error(`Failed to update ref: ${err.message || refUpdateResp.status}`);
  }

  return commit.sha;
}

/* ===========================================================
   MAIN
=========================================================== */
async function main() {
  try {
    // ===== Step 1: Device Flow =====
    const deviceData = await requestDeviceCode();

    console.log("┌─────────────────────────────────────────────────────────┐");
    console.log("│  📋 MỞ LINK VÀ NHẬP CODE:                              │");
    console.log("├─────────────────────────────────────────────────────────┤");
    console.log(`│  Link: ${deviceData.verification_uri}                       │`);
    console.log(`│  Code: ${deviceData.user_code}                            │`);
    console.log("└─────────────────────────────────────────────────────────┘");
    console.log("");
    console.log(`   1. Mở: ${deviceData.verification_uri}`);
    console.log(`   2. Nhập code: ${deviceData.user_code}`);
    console.log(`   3. Bấm "Continue" → "Authorize nexo..." → "Authorize"`);
    console.log("");

    // ===== Step 2: Poll for token =====
    const token = await pollForToken(
      deviceData.device_code,
      deviceData.interval,
      deviceData.expires_in
    );

    console.log("\n\n✅ Đã lấy được access token!\n");

    // ===== Step 3: Get user info =====
    const user = await getUserInfo(token);
    console.log(`👤 GitHub user: @${user.login}`);

    // ===== Step 4: Ensure repo exists =====
    await ensureRepo(token, REPO_OWNER, REPO_NAME);

    // ===== Step 5: Collect files =====
    console.log("\n📂 Đang thu thập files...");
    const projectDir = "/home/z/my-project";
    const filePaths = collectFiles(projectDir);
    console.log(`   Tìm thấy ${filePaths.length} files`);

    const files = readFiles(filePaths, projectDir);
    console.log(`   ${files.length} files sẽ được push`);

    // ===== Step 6: Push =====
    const commitSha = await pushFiles(token, REPO_OWNER, REPO_NAME, files);

    console.log("\n╔══════════════════════════════════════════════════════╗");
    console.log("║   ✅ PUSH THÀNH CÔNG!                                ║");
    console.log("╚══════════════════════════════════════════════════════╝");
    console.log(`\n📦 Repo: https://github.com/${REPO_OWNER}/${REPO_NAME}`);
    console.log(`💾 Commit: ${commitSha.substring(0, 7)}`);
    console.log(`📊 ${files.length} files pushed`);
    console.log(`\n🔗 Mở repo: https://github.com/${REPO_OWNER}/${REPO_NAME}`);
  } catch (err) {
    console.error("\n❌ LỖI:", err.message);
    process.exit(1);
  }
}

main();
