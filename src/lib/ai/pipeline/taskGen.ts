// ai/pipeline/taskGen.ts — Task generation + Chat assistant
// Extracted from ai.ts Phase 2

import { appendLog } from "@/lib/pipeline-progress";
import type { ProjectInput, ProjectResult, TaskItem } from "@/lib/types";
import { compressContext } from "../config/constants";
import { buildCtx } from "../utils/helpers";
import { callAndParse, callModel } from "./runner";
import { TASK_GEN_PROMPT } from "../prompts";
import { TASK_GEN_MODELS, CHAT_MODELS } from "../agents/definitions";
import type { OpenRouterError } from "@/lib/openrouter";

export async function generateTasks(
  input: ProjectInput,
  result: ProjectResult,
  onProgress?: (done: boolean) => void
): Promise<TaskItem[]> {
  onProgress?.(false);
  const base = buildCtx("analysis", result, input);
  const analysisStr = result.analysis ? compressContext(JSON.stringify(result.analysis), 2500) : "{}";
  const hrStr = result.hr ? compressContext(JSON.stringify(result.hr), 1500) : "{}";
  const sprintStr = result.sprint ? compressContext(JSON.stringify(result.sprint), 2500) : "{}";
  const designStr = result.design ? compressContext(JSON.stringify(result.design), 2500) : "{}";
  const context = `${base}\n\nPHAN TICH DU AN:\n${analysisStr.substring(0, 2500)}\n\nPHAN NHAN SU:\n${hrStr.substring(0, 1500)}\n\nSPRINT PLANNING:\n${sprintStr.substring(0, 2500)}\n\nTHIET KE HE THONG:\n${designStr.substring(0, 2500)}\n\nHay tao todolist chi tiet cho tung thanh vien.`;

  appendLog({ level: "info", agentId: "TASK", provider: "pipeline", message: `▶ TASK GENERATION STARTED — ${input.members.length} member(s)` });

  const assignments = result.hr?.assignments || [];
  for (const m of input.members) {
    const a = assignments.find((x) => x.name === m.name);
    const role = a?.role || "Backend Developer";
    const modules = a?.modules?.length ? a.modules.join(", ") : "(chưa gán module)";
    appendLog({ level: "info", agentId: "TASK", provider: "pipeline", message: `👤 ${m.name} → vai trò: ${role} · module: ${modules}` });
  }

  appendLog({ level: "info", agentId: "TASK", provider: "pipeline", message: `🤖 [TASK GEN] Gọi AI sinh todolist SMART...` });

  try {
    const res = await callAndParse(TASK_GEN_MODELS, TASK_GEN_PROMPT, context, 0.25, undefined);
    onProgress?.(true);
    if (res && res.data) {
      // Extract tasks array from any key (tasks, items, list, etc.)
      let rawTasks: TaskItem[] | null = null;
      const data = res.data as { tasks?: TaskItem[] };
      if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        rawTasks = data.tasks;
      } else {
        // Try to find tasks under any array key
        const d = res.data as Record<string, unknown>;
        for (const key of Object.keys(d)) {
          if (Array.isArray(d[key]) && d[key].length > 0 && d[key][0] && typeof d[key][0] === "object" && "title" in d[key][0]) {
            rawTasks = d[key] as TaskItem[];
            appendLog({ level: "info", agentId: "TASK", provider: "pipeline", model: res.model, message: `[TASK GEN] Tìm thấy ${rawTasks.length} task dưới key "${key}"` });
            break;
          }
        }
      }

      if (rawTasks && rawTasks.length > 0) {
        // DEDUP — applied to ALL code paths (was missing before, causing duplicate tasks)
        // Normalize title for fuzzy matching (lowercase, trim, remove extra spaces, remove punctuation)
        // FIX: Use Unicode-aware regex \p{L}\p{N} to preserve Vietnamese diacritics
        // (was [^\w\s] which is ASCII-only → strips ạ ố ế ư ơ đ → false dedup)
        const normalize = (s: string) =>
          (s || "").toLowerCase().trim()
            .replace(/\s+/g, " ")
            .replace(/[^\p{L}\p{N}\s]/gu, "");
        const seen = new Set<string>();
        const uniqueTasks = rawTasks.filter((t) => {
          const titleNorm = normalize(t.title || "");
          const assigneeNorm = normalize(t.assigneeName || "");
          // Dedup by (title + assignee) — same task for same person = duplicate
          // Also dedup by title alone if assignee empty (prevent global dupes)
          const key = assigneeNorm ? `${titleNorm}|${assigneeNorm}` : `|${titleNorm}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const dupesRemoved = rawTasks.length - uniqueTasks.length;
        if (dupesRemoved > 0) {
          appendLog({ level: "warn", agentId: "TASK", provider: "pipeline", model: res.model, message: `⚠ [TASK GEN] Loại bỏ ${dupesRemoved} task trùng lặp` });
        }
        appendLog({ level: "success", agentId: "TASK", provider: "pipeline", model: res.model, message: `✓ [TASK GEN] AI trả về ${uniqueTasks.length} task(s) (${res.model})` });
        for (const t of uniqueTasks) {
          appendLog({ level: "success", agentId: "TASK", provider: "pipeline", message: `✓ Sinh task cho ${t.assigneeName || "?"}: ${t.title || "Untitled"}` });
        }
        return uniqueTasks;
      }
    }
    return generateFallbackTasks(input, result);
  } catch (err) {
    appendLog({ level: "error", agentId: "TASK", provider: "pipeline", message: `✗ [TASK GEN] Error: ${err instanceof Error ? err.message : "unknown"} — fallback` });
    onProgress?.(true);
    return generateFallbackTasks(input, result);
  }
}

function generateFallbackTasks(input: ProjectInput, result: ProjectResult): TaskItem[] {
  appendLog({ level: "warn", agentId: "TASK", provider: "fallback", message: `▷ FALLBACK — sinh task tĩnh theo vai trò` });
  const today = new Date();
  const tasks: TaskItem[] = [];
  const fallbackTasksByRole: Record<string, { title: string; layer: string; targetFile: string; steps: string[]; hints: { snippet: string; note: string } }[]> = {
    "Frontend Developer": [
      { title: "Tao project structure va cai dat dependencies", layer: "CONFIG", targetFile: "package.json", steps: ["1. Khoi tao project", "2. Cai dat Tailwind + shadcn/ui", "3. Cau hinh ESLint"], hints: { snippet: "npm create vite@latest my-app", note: "TypeScript" } },
      { title: "Thiet ke layout chinh va routing", layer: "UI", targetFile: "src/App.tsx", steps: ["1. Tao Layout", "2. React Router", "3. Dashboard"], hints: { snippet: "<Layout><Routes></Routes></Layout>", note: "Responsive" } },
      { title: "Xay dung components UI co ban", layer: "UI", targetFile: "src/components/", steps: ["1. Button, Input, Card", "2. DataTable", "3. Modal"], hints: { snippet: "export function Button({children}) { return <button>{children}</button> }", note: "CVA" } },
    ],
    "Backend Developer": [
      { title: "Thiet ke database schema va models", layer: "DATABASE", targetFile: "prisma/schema.prisma", steps: ["1. Prisma models", "2. Relations", "3. Migrate"], hints: { snippet: "model User { id String @id @default(cuid()) }", note: "cuid()" } },
      { title: "Xay dung API routes CRUD", layer: "BACKEND", targetFile: "src/app/api/", steps: ["1. GET/POST", "2. Zod validation", "3. Error handling"], hints: { snippet: "export async function GET() { return Response.json(await db.user.findMany()) }", note: "Response.json" } },
      { title: "Implement authentication", layer: "BACKEND", targetFile: "src/lib/auth.ts", steps: ["1. JWT", "2. Login/register API", "3. Middleware"], hints: { snippet: "jwt.sign({userId}, secret, {expiresIn: '7d'})", note: ".env secret" } },
    ],
    "Database Engineer": [
      { title: "Thiet ke va tao database schema", layer: "DATABASE", targetFile: "prisma/schema.prisma", steps: ["1. Entities", "2. Relations + indexes", "3. Migration"], hints: { snippet: "model Order { id String @id items OrderItem[] }", note: "Index" } },
      { title: "Viet SQL queries va stored procedures", layer: "DATABASE", targetFile: "src/lib/queries.ts", steps: ["1. JOIN queries", "2. Aggregation", "3. Optimize"], hints: { snippet: "SELECT u.name, COUNT(o.id) FROM users u LEFT JOIN orders o ON o.userId = u.id GROUP BY u.id", note: "EXPLAIN" } },
    ],
    "QA/Tester": [
      { title: "Cai dat testing framework va viet unit tests", layer: "TESTING", targetFile: "tests/unit/", steps: ["1. Vitest/Jest", "2. Unit tests", "3. API tests"], hints: { snippet: "test('should create user', async () => { expect(res.status).toBe(201) })", note: "Mock db" } },
      { title: "Viet integration tests va E2E tests", layer: "TESTING", targetFile: "tests/e2e/", steps: ["1. Playwright", "2. Login flow", "3. CRUD"], hints: { snippet: "test('login', async ({page}) => { await page.goto('/login') })", note: "Test db" } },
    ],
    "DevOps": [
      { title: "Cau hinh CI/CD pipeline", layer: "CONFIG", targetFile: ".github/workflows/ci.yml", steps: ["1. GitHub Actions", "2. Build + test + lint", "3. Auto deploy"], hints: { snippet: "name: CI\\non: [push]", note: "Cache" } },
      { title: "Cau hinh Docker va deployment", layer: "CONFIG", targetFile: "Dockerfile", steps: ["1. Multi-stage", "2. docker-compose", "3. Env vars"], hints: { snippet: "FROM node:20-alpine AS build", note: "Alpine" } },
    ],
  };

  for (const m of input.members) {
    const assignment = result.hr?.assignments?.find((a) => a.name === m.name);
    const role = assignment?.role || "Backend Developer";
    const roleTasks = fallbackTasksByRole[role] || fallbackTasksByRole["Backend Developer"];
    for (const ft of roleTasks) {
      tasks.push({
        assigneeName: m.name, title: ft.title,
        description: `${ft.title} cho ${role}. File: ${ft.targetFile}.`,
        role, layer: ft.layer, targetFile: ft.targetFile,
        responsibilities: ["Thuc hien theo steps", "Test locally", "Tao PR"],
        codeConventions: ["Tuan thu convention", "Conventional commits"],
        implementationSteps: ft.steps, technicalHints: ft.hints,
        dependencies: "Setup project xong",
        acceptanceCriteria: ["Code chay", "Pass tests", "Review approved"],
        deadline: new Date(today.getTime() + 7 * 86400000).toISOString().split("T")[0],
        sprintName: "Sprint 1", status: "todo", hours: 8, priority: "P0",
      } as TaskItem);
    }
  }
  appendLog({ level: "success", agentId: "TASK", provider: "fallback", message: `✅ FALLBACK — ${tasks.length} task(s) cho ${input.members.length} thành viên` });
  return tasks;
}

export async function chatAssistant(
  input: ProjectInput,
  result: ProjectResult,
  recentMessages: string
): Promise<string> {
  const sys = `Ban la NEXUS AI Assistant trong phong chat cua du an "${input.topic}". Ban giup nhom ra quyet dinh, tong hop y kien, va de xuat chinh sua. Tra loi ngan gon, bang tieng Viet.`;
  const usr = `Thong tin du an:\n- Tech: ${result.analysis?.techStack?.frontend?.name || "?"} + ${result.analysis?.techStack?.backend?.name || "?"}\n- Modules: ${result.analysis?.modules?.join(", ") || "?"}\n- Thanh vien: ${input.members.map((m) => m.name).join(", ")}\n\nTIN NHAN GAN DAY:\n${recentMessages}\n\nHay phan hoi / tong hop / goi y.`;

  for (const model of CHAT_MODELS) {
    try {
      return await callModel(model, sys, usr, 0.5);
    } catch (err) {
      const e = err as OpenRouterError;
      console.log(`  [CHAT] ${model} failed: ${e.status || e.code} — trying next`);
    }
  }
  return "Xin loi, toi khong the phan hoi luc nay.";
}
