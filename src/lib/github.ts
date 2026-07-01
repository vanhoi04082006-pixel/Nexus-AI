// NEXUS AI - GitHub integration
// Generates project files from AI results and pushes them to a GitHub repo
// via the REST API (no git CLI needed).

import { db } from "./db";
import type { ProjectResult, ProjectInput } from "./types";

/* ===========================================================
   GitHub API helpers
=========================================================== */
const GITHUB_API = "https://api.github.com";

interface GhFile {
  path: string;
  content: string;
}

async function ghFetch(path: string, token: string, init?: RequestInit) {
  const resp = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "NEXUS-AI",
      ...(init?.headers || {}),
    },
  });
  return resp;
}

/** Create a new repo for the user. Returns the repo object. */
async function createRepo(
  token: string,
  name: string,
  description: string,
  isPrivate: boolean
): Promise<{ full_name: string; default_branch: string }> {
  const resp = await ghFetch("/user/repos", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      description,
      private: isPrivate,
      auto_init: true, // creates initial commit with README
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Failed to create repo: ${err.message || resp.status}`);
  }
  return (await resp.json()) as { full_name: string; default_branch: string };
}

/** Get the SHA of the default branch's latest commit. */
async function getDefaultBranchSha(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<string | null> {
  const resp = await ghFetch(
    `/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    token
  );
  if (!resp.ok) return null;
  const data = (await resp.json()) as { object: { sha: string } };
  return data.object.sha;
}

/** Get the tree SHA that a commit points to. */
async function getCommitTreeSha(
  token: string,
  owner: string,
  repo: string,
  commitSha: string
): Promise<string> {
  const resp = await ghFetch(
    `/repos/${owner}/${repo}/git/commits/${commitSha}`,
    token
  );
  if (!resp.ok) throw new Error("Failed to get commit");
  const data = (await resp.json()) as { tree: { sha: string } };
  return data.tree.sha;
}

/** Create a blob (file content) and return its SHA. */
async function createBlob(
  token: string,
  owner: string,
  repo: string,
  content: string
): Promise<string> {
  const resp = await ghFetch(`/repos/${owner}/${repo}/git/blobs`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, encoding: "utf-8" }),
  });
  if (!resp.ok) throw new Error("Failed to create blob");
  const data = (await resp.json()) as { sha: string };
  return data.sha;
}

/** Create a tree referencing all blobs, returns the tree SHA. */
async function createTree(
  token: string,
  owner: string,
  repo: string,
  baseTreeSha: string | null,
  files: { path: string; sha: string }[]
): Promise<string> {
  const tree = files.map((f) => ({
    path: f.path,
    mode: "100644",
    type: "blob",
    sha: f.sha,
  }));
  const body: Record<string, unknown> = { tree };
  if (baseTreeSha) body.base_tree = baseTreeSha;
  const resp = await ghFetch(`/repos/${owner}/${repo}/git/trees`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error("Failed to create tree");
  const data = (await resp.json()) as { sha: string };
  return data.sha;
}

/** Create a commit and return its SHA. */
async function createCommit(
  token: string,
  owner: string,
  repo: string,
  message: string,
  treeSha: string,
  parentSha: string | null
): Promise<string> {
  const body: Record<string, unknown> = { message, tree: treeSha };
  if (parentSha) body.parents = [parentSha];
  const resp = await ghFetch(`/repos/${owner}/${repo}/git/commits`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error("Failed to create commit");
  const data = (await resp.json()) as { sha: string };
  return data.sha;
}

/** Update a branch ref to point to a new commit. */
async function updateRef(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  commitSha: string
): Promise<void> {
  const resp = await ghFetch(
    `/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    token,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commitSha }),
    }
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Failed to update ref: ${err.message || resp.status}`);
  }
}

/* ===========================================================
   File generation from AI results
=========================================================== */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40);
}

function generateFiles(
  input: ProjectInput,
  result: ProjectResult,
  members: { name: string; role: string; email: string }[],
  tasks: {
    assigneeName: string;
    title: string;
    description: string;
    role: string;
    responsibilities: string;
    codeConventions: string;
    dependencies: string;
    acceptanceCriteria: string;
    deadline: string | null;
    sprintName: string;
    hours: number;
    priority: string;
    status: string;
  }[]
): GhFile[] {
  const files: GhFile[] = [];
  const ts = result;
  const a = ts.analysis;
  const hr = ts.hr;
  const sp = ts.sprint;
  const design = ts.design;
  const docs = ts.docs;
  const git = ts.git;

  // ===== README.md =====
  files.push({
    path: "README.md",
    content: docs.readme || `# ${input.topic}\n\nDu an duoc phan tich boi NEXUS AI.`,
  });

  // ===== .gitignore =====
  files.push({
    path: ".gitignore",
    content: `# Dependencies
node_modules/
__pycache__/
*.pyc
venv/
.env
.env.local

# Build
dist/
build/
.next/
out/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp

# Logs
*.log
npm-debug.log*
`,
  });

  // ===== docs/CODING_CONVENTION.md =====
  if (docs.convention) {
    files.push({ path: "docs/CODING_CONVENTION.md", content: docs.convention });
  }

  // ===== docs/API_STANDARD.md =====
  if (docs.apiStandard) {
    files.push({ path: "docs/API_STANDARD.md", content: docs.apiStandard });
  }

  // ===== docs/ARCHITECTURE.md =====
  let archContent = `# Kien truc He thong\n\n## Mo ta\n\n${design.architectureDesc || "N/A"}\n\n## Tech Stack\n\n`;
  const ts2 = a.techStack;
  if (ts2) {
    archContent += `| Layer | Technology | Version | Reason |\n|---|---|---|---|\n`;
    for (const layer of ["frontend", "backend", "database", "cache"] as const) {
      const t = ts2[layer as keyof typeof ts2];
      if (t && typeof t === "object" && "name" in t) {
        archContent += `| ${layer} | ${t.name} | ${t.ver} | ${t.reason} |\n`;
      }
    }
    if (ts2.tools && ts2.tools.length) {
      archContent += `\n**Tools:** ${ts2.tools.join(", ")}\n`;
    }
  }
  archContent += `\n## Modules\n\n${(a.modules || []).map((m, i) => `- M${i + 1}: ${m}`).join("\n")}\n`;
  files.push({ path: "docs/ARCHITECTURE.md", content: archContent });

  // ===== docs/DATABASE.md =====
  let dbContent = `# Database Schema\n\n`;
  for (const t of design.dbTables || []) {
    dbContent += `## ${t.name}\n\n`;
    dbContent += `**Columns:**\n${(t.columns || []).map((c) => `- \`${c}\``).join("\n")}\n\n`;
    if (t.relations && t.relations.length) {
      dbContent += `**Relations:**\n${t.relations.map((r) => `- ${r}`).join("\n")}\n\n`;
    }
  }
  files.push({ path: "docs/DATABASE.md", content: dbContent });

  // ===== docs/API_ENDPOINTS.md =====
  let apiContent = `# API Endpoints\n\n| Method | Path | Mo ta |\n|---|---|---|\n`;
  for (const e of design.apiEndpoints || []) {
    apiContent += `| \`${e.method}\` | \`${e.path}\` | ${e.desc} |\n`;
  }
  files.push({ path: "docs/API_ENDPOINTS.md", content: apiContent });

  // ===== docs/SPRINT_PLAN.md =====
  let sprintContent = `# Sprint Plan\n\n**Tong:** ${sp.totalSprints || 0} Sprint x ${sp.sprintDuration || "2 tuan"}\n\n`;
  for (const s of sp.sprints || []) {
    sprintContent += `## ${s.name}\n`;
    sprintContent += `**Thoi gian:** ${s.start} → ${s.end}\n\n`;
    if (s.goals && s.goals.length) {
      sprintContent += `**Muc tieu:**\n${s.goals.map((g) => `- ${g}`).join("\n")}\n\n`;
    }
    if (s.tasks && s.tasks.length) {
      sprintContent += `**Tasks:**\n\n| Task | Assignee | Hours | Status |\n|---|---|---|---|\n`;
      for (const t of s.tasks) {
        sprintContent += `| ${t.task} | ${t.assignee} | ${t.hours}h | ${t.status} |\n`;
      }
      sprintContent += `\n`;
    }
  }
  if (sp.milestones && sp.milestones.length) {
    sprintContent += `## Milestones\n\n| Date | Event |\n|---|---|\n`;
    for (const m of sp.milestones) {
      sprintContent += `| ${m.date} | ${m.event} |\n`;
    }
  }
  files.push({ path: "docs/SPRINT_PLAN.md", content: sprintContent });

  // ===== docs/TEAM.md =====
  let teamContent = `# Team & Roles\n\n`;
  teamContent += `**Nhom truong:** ${input.leaderName}\n\n`;
  teamContent += `**Phu hop:** ${hr.coverage || "N/A"}\n\n`;
  teamContent += `## Phan cong Vai tro\n\n`;
  for (const m of hr.assignments || []) {
    teamContent += `### ${m.name} — ${m.role}\n`;
    teamContent += `- **Workload:** ${m.workload}%\n`;
    teamContent += `- **Ly do:** ${m.reason}\n`;
    teamContent += `- **Uu diem:** ${m.strengths || "N/A"}\n`;
    teamContent += `- **Nhuoc diem:** ${m.weaknesses || "N/A"}\n`;
    if (m.modules && m.modules.length) {
      teamContent += `- **Modules:** ${m.modules.join(", ")}\n`;
    }
    teamContent += `\n`;
  }
  if (hr.risks && hr.risks.length) {
    teamContent += `## Rui ro\n\n| Rui ro | Giam thieu |\n|---|---|\n`;
    for (const r of hr.risks) {
      teamContent += `| ${r.risk} | ${r.mitigation} |\n`;
    }
  }
  files.push({ path: "docs/TEAM.md", content: teamContent });

  // ===== docs/TASKS.md (todolist) =====
  if (tasks.length > 0) {
    let taskContent = `# Todolist\n\n`;
    taskContent += `**Tong:** ${tasks.length} tasks\n\n`;
    // Group by member
    const byMember: Record<string, typeof tasks> = {};
    for (const t of tasks) {
      const key = t.assigneeName || "Unassigned";
      if (!byMember[key]) byMember[key] = [];
      byMember[key].push(t);
    }
    for (const [memberName, memberTasks] of Object.entries(byMember)) {
      taskContent += `## ${memberName}\n\n`;
      for (const t of memberTasks) {
        taskContent += `### [${t.priority}] ${t.title}\n`;
        taskContent += `**Vai tro:** ${t.role} | **Sprint:** ${t.sprintName} | **Hours:** ${t.hours}h | **Deadline:** ${t.deadline || "N/A"}\n\n`;
        taskContent += `**Mo ta:** ${t.description}\n\n`;
        if (t.responsibilities) {
          taskContent += `**Trach nhiem:**\n${t.responsibilities.split("\n").map((r) => `- ${r}`).join("\n")}\n\n`;
        }
        if (t.codeConventions) {
          taskContent += `**Quy uoc code (QUAN TRONG):**\n${t.codeConventions.split("\n").map((c) => `- \`${c}\``).join("\n")}\n\n`;
        }
        if (t.dependencies) {
          taskContent += `**Phu thuoc:** ${t.dependencies}\n\n`;
        }
        if (t.acceptanceCriteria) {
          taskContent += `**Tieu chi hoan thanh:**\n${t.acceptanceCriteria.split("\n").map((c) => `- [ ] ${c}`).join("\n")}\n\n`;
        }
        taskContent += `---\n\n`;
      }
    }
    files.push({ path: "docs/TASKS.md", content: taskContent });
  }

  // ===== docs/UML/ diagrams as .mmd files =====
  const uml = ts.uml;
  if (uml.useCase) files.push({ path: "docs/UML/use-case.mmd", content: uml.useCase });
  if (uml.classDiagram) files.push({ path: "docs/UML/class-diagram.mmd", content: uml.classDiagram });
  if (uml.erd) files.push({ path: "docs/UML/erd.mmd", content: uml.erd });
  if (uml.sequence) files.push({ path: "docs/UML/sequence.mmd", content: uml.sequence });

  // ===== .github/ISSUE_TEMPLATE/task.md =====
  if (git.issueTemplate) {
    files.push({ path: ".github/ISSUE_TEMPLATE/task.md", content: git.issueTemplate });
  }

  // ===== FOLDER_STRUCTURE.txt =====
  if (design.folderStructure) {
    files.push({ path: "FOLDER_STRUCTURE.txt", content: design.folderStructure });
  }

  // ===== PROJECT_SUMMARY.md =====
  let summaryContent = `# ${input.topic}\n\n`;
  summaryContent += `> Du an duoc phan tich va thiet ke boi **NEXUS AI - Multi-Agent Architect** (8 AI Agents).\n\n`;
  summaryContent += `## Thong tin chung\n\n`;
  summaryContent += `- **Mo ta:** ${a.desc || input.description}\n`;
  summaryContent += `- **So thanh vien:** ${a.teamSize || input.members.length}\n`;
  summaryContent += `- **Thoi gian du kien:** ${a.estimatedDuration}\n`;
  summaryContent += `- **Do phuc tap:** ${a.complexity}\n`;
  summaryContent += `- **Muc dich:** ${input.purpose || "N/A"}\n\n`;
  summaryContent += `## Features\n\n| # | Feature | Module | Uu tien |\n|---|---|---|---|\n`;
  (a.features || []).forEach((f, i) => {
    summaryContent += `| ${i + 1} | ${f.name} | ${f.module} | ${f.pri} |\n`;
  });
  summaryContent += `\n## Actors\n\n`;
  for (const actor of a.actors || []) {
    summaryContent += `- **${actor.name}**: ${actor.desc}\n`;
  }
  summaryContent += `\n---\n\n*Generated by NEXUS AI on ${new Date().toISOString()}*\n`;
  files.push({ path: "PROJECT_SUMMARY.md", content: summaryContent });

  return files;
}

/* ===========================================================
   Main: push project to GitHub
=========================================================== */
export interface PushResult {
  repoUrl: string;
  repoName: string;
  fileCount: number;
  commitSha: string;
}

export async function pushProjectToGitHub(
  projectId: string
): Promise<PushResult> {
  // ===== Load project data =====
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      members: true,
      analyses: true,
      tasks: true,
    },
  });
  if (!project) throw new Error("Project not found");
  if (!project.githubToken) throw new Error("Chua ket noi GitHub. Hay nhan 'Connect GitHub' truoc.");
  if (!project.githubUsername) throw new Error("Khong tim thay GitHub username.");

  const token = project.githubToken;
  const owner = project.githubUsername;

  // ===== Reconstruct ProjectResult =====
  const result: Record<string, unknown> = {};
  for (const a of project.analyses) {
    try {
      result[a.type] = JSON.parse(a.content);
    } catch {
      result[a.type] = {};
    }
  }
  const projectResult = result as unknown as ProjectResult;

  // ===== Reconstruct ProjectInput =====
  let extraInfo: ProjectInput["extraInfo"] = {
    requirements: [],
    specialReqs: "",
    techPrefs: [],
    langPrefs: [],
  };
  try {
    const parsed = JSON.parse(project.extraInfo || "{}");
    extraInfo = {
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
      specialReqs: parsed.specialReqs || "",
      techPrefs: Array.isArray(parsed.techPrefs) ? parsed.techPrefs : [],
      langPrefs: Array.isArray(parsed.langPrefs) ? parsed.langPrefs : [],
    };
  } catch {
    /* keep defaults */
  }
  const input: ProjectInput = {
    topic: project.topic,
    description: project.description,
    purpose: project.purpose,
    extraInfo,
    members: project.members.map((m) => ({
      name: m.name,
      email: m.email,
      strengths: m.strengths,
      weaknesses: m.weaknesses,
    })),
    leaderName: project.leaderName,
    leaderEmail: project.leaderEmail,
  };

  const members = project.members.map((m) => ({
    name: m.name,
    role: m.role,
    email: m.email,
  }));

  const tasks = project.tasks.map((t) => ({
    assigneeName: t.assigneeName,
    title: t.title,
    description: t.description,
    role: t.role,
    responsibilities: t.responsibilities,
    codeConventions: t.codeConventions,
    dependencies: t.dependencies,
    acceptanceCriteria: t.acceptanceCriteria,
    deadline: t.deadline ? t.deadline.toISOString().split("T")[0] : null,
    sprintName: t.sprintName,
    hours: t.hours,
    priority: t.priority,
    status: t.status,
  }));

  // ===== Generate files =====
  const files = generateFiles(input, projectResult, members, tasks);
  console.log(`[GitHub push] Generated ${files.length} files for project ${projectId}`);

  // ===== Determine repo name =====
  const repoName = project.githubRepoName || `nexus-${slugify(project.topic)}`;
  const description = `${project.topic} — Generated by NEXUS AI`;

  // ===== Create repo (or use existing) =====
  let repoFullName = `${owner}/${repoName}`;
  let defaultBranch = "main";
  try {
    const repo = await createRepo(token, repoName, description, false);
    repoFullName = repo.full_name;
    defaultBranch = repo.default_branch || "main";
    console.log(`[GitHub push] Created repo ${repoFullName}`);
  } catch (err) {
    // Repo might already exist — try to use it
    console.log(`[GitHub push] Repo create failed (may exist), trying existing:`, (err as Error).message);
    const checkResp = await ghFetch(`/repos/${owner}/${repoName}`, token);
    if (!checkResp.ok) {
      throw new Error(`Khong the tao hoac tim thay repo ${repoName}: ${(err as Error).message}`);
    }
    const existingRepo = (await checkResp.json()) as { full_name: string; default_branch: string };
    repoFullName = existingRepo.full_name;
    defaultBranch = existingRepo.default_branch || "main";
  }

  // ===== Get the latest commit SHA on the default branch =====
  let parentSha = await getDefaultBranchSha(token, owner, repoName, defaultBranch);
  let baseTreeSha: string | null = null;

  if (parentSha) {
    baseTreeSha = await getCommitTreeSha(token, owner, repoName, parentSha);
    console.log(`[GitHub push] Base commit: ${parentSha.substring(0, 7)}, tree: ${baseTreeSha?.substring(0, 7)}`);
  } else {
    // Empty repo — no commits yet
    parentSha = null;
    baseTreeSha = null;
  }

  // ===== Create blobs for all files =====
  const fileShas: { path: string; sha: string }[] = [];
  for (const file of files) {
    const sha = await createBlob(token, owner, repoName, file.content);
    fileShas.push({ path: file.path, sha });
  }
  console.log(`[GitHub push] Created ${fileShas.length} blobs`);

  // ===== Create tree =====
  const treeSha = await createTree(token, owner, repoName, baseTreeSha, fileShas);

  // ===== Create commit =====
  const commitMessage = `NEXUS AI: Khoi tao du an "${project.topic}"\n\n- ${files.length} files generated by 8 AI Agents\n- Analysis, HR, Sprint, Design, UML, Docs, Git workflow\n- ${tasks.length} tasks assigned to ${members.length} members`;
  const commitSha = await createCommit(token, owner, repoName, commitMessage, treeSha, parentSha);

  // ===== Update ref =====
  await updateRef(token, owner, repoName, defaultBranch, commitSha);

  // ===== Save repo info to DB =====
  await db.project.update({
    where: { id: projectId },
    data: {
      githubRepoName: repoName,
      githubPushedAt: new Date(),
    },
  });

  console.log(`[GitHub push] SUCCESS — ${files.length} files pushed to ${repoFullName}`);

  return {
    repoUrl: `https://github.com/${repoFullName}`,
    repoName: repoFullName,
    fileCount: files.length,
    commitSha,
  };
}
