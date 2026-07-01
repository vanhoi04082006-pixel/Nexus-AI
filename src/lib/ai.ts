// NEXUS AI - Multi-Agent AI Service (OpenRouter)
// Port of the original v5.0 aiService.js to TypeScript + Next.js.
// Each Agent has a tailored model list, 2 retries per model with exponential
// backoff, a JSON fixer, an AI self-fix pass, and graceful fallbacks.

import { callOpenRouter, type OpenRouterError } from "./openrouter";
import type {
  ProjectResult,
  ProjectInput,
  TaskItem,
  SectionType,
} from "./types";

/* ===========================================================
   Tunables
=========================================================== */
const REQ_TIMEOUT = 120000;
const MAX_RETRIES = 2;
const INIT_DELAY = 2000;
const BACKOFF_MULT = 2;
const MAX_DELAY = 30000;

/* ===========================================================
   PRIMARY MODELS (safe fallbacks that are known to work)
=========================================================== */
const SAFE_1 = "openai/gpt-oss-120b:free";
const SAFE_2 = "cohere/north-mini-code:free";

/* ===========================================================
   AGENT DEFINITIONS
   Each agent has its own model priority list suited to its task.
=========================================================== */
interface AgentDef {
  id: string;
  name: string;
  prompt: () => string;
  key: SectionType;
  required: boolean;
  temp: number;
  models: string[];
}

const AGENTS: AgentDef[] = [
  {
    id: "01",
    name: "Requirement Analyst",
    key: "analysis",
    required: true,
    temp: 0.2,
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "openai/gpt-oss-120b:free",
      SAFE_1,
    ],
  },
  {
    id: "02",
    name: "HR Planner",
    key: "hr",
    required: false,
    temp: 0.25,
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "google/gemma-4-31b-it:free",
      SAFE_1,
    ],
  },
  {
    id: "03",
    name: "Sprint Planner",
    key: "sprint",
    required: false,
    temp: 0.2,
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      SAFE_1,
    ],
  },
  {
    id: "04",
    name: "System Architect",
    key: "design",
    required: true,
    temp: 0.15,
    models: [
      "poolside/laguna-m.1:free",
      "openai/gpt-oss-120b:free",
      "cohere/north-mini-code:free",
      "poolside/laguna-xs.2:free",
      SAFE_1,
    ],
  },
  {
    id: "05",
    name: "UML Generator",
    key: "uml",
    required: false,
    temp: 0.1,
    models: [
      "poolside/laguna-m.1:free",
      "openai/gpt-oss-120b:free",
      "cohere/north-mini-code:free",
      "poolside/laguna-xs.2:free",
      SAFE_2,
    ],
  },
  {
    id: "06",
    name: "Technical Writer",
    key: "docs",
    required: false,
    temp: 0.35,
    models: [
      "google/gemma-4-31b-it:free",
      "openai/gpt-oss-120b:free",
      SAFE_1,
    ],
  },
  {
    id: "07",
    name: "Git / DevOps",
    key: "git",
    required: false,
    temp: 0.15,
    models: [
      "poolside/laguna-xs.2:free",
      "cohere/north-mini-code:free",
      SAFE_2,
    ],
  },
];

const REVIEWER_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-120b:free",
  "google/gemma-4-31b-it:free",
];

const TASK_GEN_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "openai/gpt-oss-120b:free",
  "cohere/north-mini-code:free",
  SAFE_1,
];

const CHAT_MODELS = [
  "openai/gpt-oss-120b:free",
  "google/gemma-4-31b-it:free",
  SAFE_1,
];

/* ===========================================================
   SCHEMA VALIDATION
=========================================================== */
const MIN_KEYS: Record<SectionType, string[]> = {
  analysis: ["desc", "techStack", "features", "modules"],
  hr: ["assignments"],
  sprint: ["sprints"],
  design: ["dbTables", "apiEndpoints", "folderStructure"],
  uml: ["useCase", "classDiagram", "erd", "sequence"],
  docs: ["readme"],
  git: ["gitCommands", "branchStrategy"],
};

function isValidSchema(d: unknown, k: SectionType): boolean {
  if (!d || typeof d !== "object") return false;
  const obj = d as Record<string, unknown>;
  return (MIN_KEYS[k] || []).every((k2) => obj[k2] != null);
}

function isEmptyObj(o: unknown): boolean {
  if (!o || typeof o !== "object") return true;
  return Object.keys(o as object).length === 0;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ===========================================================
   JSON FIXER
=========================================================== */
class JFix {
  static fix(raw: string): string {
    if (!raw || typeof raw !== "string") return "";
    let s = raw.trim();
    if (s.startsWith("```json")) s = s.substring(7);
    else if (s.startsWith("```")) s = s.substring(3);
    if (s.endsWith("```")) s = s.substring(0, s.length - 3);
    // NOTE: do NOT strip // globally — it breaks URLs (https://) inside strings.
    // Comment stripping + trailing comma + newline fixing all happen in the
    // string-aware char loop below so string contents are preserved.
    s = s.replace(/,\s*([\]}])/g, "$1");
    let r = "";
    let inS = false;
    let es = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (es) {
        r += c;
        es = false;
        continue;
      }
      if (c === "\\" && inS) {
        r += c;
        es = true;
        continue;
      }
      if (c === '"') {
        inS = !inS;
        r += c;
        continue;
      }
      if (inS && (c === "\n" || c === "\r")) {
        r += "\\n";
        continue;
      }
      if (!inS && (c === "\n" || c === "\r" || c === "\t")) continue;
      // Strip // comments ONLY outside strings (preserves https:// in URLs)
      if (!inS && c === "/" && s[i + 1] === "/") {
        // skip to end of line
        while (i < s.length && s[i] !== "\n") i++;
        continue;
      }
      r += c;
    }
    return r;
  }

  static parse(raw: string): unknown {
    if (!raw || typeof raw !== "string") throw new Error("Empty");
    try {
      return JSON.parse(raw.trim());
    } catch {
      /* continue */
    }
    try {
      return JSON.parse(this.fix(raw));
    } catch {
      /* continue */
    }
    try {
      const a = raw.indexOf("{");
      const b = raw.lastIndexOf("}");
      if (a !== -1 && b > a) return JSON.parse(this.fix(raw.substring(a, b + 1)));
    } catch {
      /* continue */
    }
    throw new Error("Parse fail");
  }
}

/* ===========================================================
   Core: call model + parse JSON, with retries per model
=========================================================== */
async function callModel(
  model: string,
  sys: string,
  usr: string,
  temp: number
): Promise<string> {
  return callOpenRouter(
    {
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ],
      temperature: temp,
      max_tokens: 8000,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
    },
    REQ_TIMEOUT
  );
}

interface ParseResult {
  data: unknown;
  model: string;
}

async function callAndParse(
  models: string[],
  sys: string,
  usr: string,
  temp: number
): Promise<ParseResult | null> {
  for (const model of models) {
    let d = INIT_DELAY;

    for (let a = 1; a <= MAX_RETRIES; a++) {
      try {
        console.log(`      [${a}/${MAX_RETRIES}] ${model}`);
        const raw = await callModel(model, sys, usr, temp);
        let data: unknown = null;

        // Parse pipeline: 4 attempts
        try {
          data = JSON.parse(raw.trim());
        } catch {
          /* continue */
        }
        if (!data)
          try {
            data = JSON.parse(JFix.fix(raw));
          } catch {
            /* continue */
          }
        if (!data) {
          const s = raw.indexOf("{");
          const e = raw.lastIndexOf("}");
          if (s !== -1 && e > s)
            try {
              data = JSON.parse(JFix.fix(raw.substring(s, e + 1)));
            } catch {
              /* continue */
            }
        }
        if (!data) {
          // AI self-fix pass
          console.log(`      [${a}] JSON loi, AI sua...`);
          const fix = await callModel(
            model,
            "JSON fixer. Chi tra JSON hop le, khong them gi nua.",
            `Sua JSON loi:\n${(raw || "").substring(0, 5000)}`,
            0.1
          );
          data = JFix.parse(fix);
        }

        if (data) {
          console.log(`      ✓ ${model} (lan ${a})`);
          return { data, model };
        }
      } catch (err) {
        const e = err as OpenRouterError;
        const st = e.status;
        const msg = (e.message || "").substring(0, 120);
        console.log(`      ✗ [${a}] ${model} → [${st || e.code || "NET"}] ${msg}`);

        // 429: rate limit — wait and retry same model
        if (st === 429) {
          const ra = e.retryAfter || d;
          console.log(`      ⏳ Rate limit, doi ${Math.min(ra, MAX_DELAY)}ms`);
          await wait(Math.min(ra, MAX_DELAY));
          d = Math.min(d * BACKOFF_MULT, MAX_DELAY);
          continue;
        }

        // 5xx / timeout / network: retry same model with backoff
        if (
          (st && st >= 500) ||
          e.code === "ETIMEDOUT" ||
          e.code === "ENET" ||
          e.code === "ECONNRESET"
        ) {
          console.log(`      ⏳ Server/timeout, doi ${d}ms`);
          await wait(d);
          d = Math.min(d * BACKOFF_MULT, MAX_DELAY);
          continue;
        }

        // 401/403: invalid API key or forbidden — FATAL, don't try other models
        if (st === 401 || st === 403) {
          throw new Error(
            st === 401
              ? "OPENROUTER_API_KEY khong hop le. Kiem tra file .env"
              : "OpenRouter access forbidden (403). Kiem tra API key hoac credit."
          );
        }

        // 4xx (non-429, non-401/403): invalid model / bad request — skip to next model
        break;
      }
    }
  }
  return null;
}

/* ===========================================================
   PROMPT BUILDERS
=========================================================== */
const JSON_INSTRUCTION = `TRA VE JSON THUAN TUY (pure JSON). Tuyet doi KHONG dung markdown code block (\`\`\`json), KHONG comment, KHONG trailing comma. Tat ca string phai dung \\n cho xuong dong, khong dung newline that. Neu khong biet gia tri thi dung "" hoac [].`;

function analystPrompt(): string {
  return `Ban la Senior Requirement Analyst & Tech Lead. Phan tich du an KY LUONG, CHI TIET va DAY DU.
${JSON_INSTRUCTION}
Tra object voi cac key BAT BUOC:
- "desc" (string): mo ta du an 5-7 cau, ro rang chi tiet cho nguoi moi hieu. Ghi ro: muc dich chinh, nguoi dung cuoi, van de giai quyet, quy mo du kien, cac tinh nang noi bat.
- "techStack" (object): { "frontend": {name, ver, reason}, "backend": {name, ver, reason}, "database": {name, ver, reason}, "cache": {name, ver, reason}, "tools": [string] }. Reason phai giai thich tai sao chon, it nhat 2-3 ly do.
- "teamSize" (number)
- "estimatedDuration" (string): vi du "6-8 tuan"
- "complexity" (string): vi du "Trung binh - Cao"
- "features" (array): moi phan tu { "name", "module", "pri" } voi pri la "P0" | "P1" | "P2". P0 = bat buoc, P1 = quan trong, P2 = nice-to-have. It nhat 12 features, phu cover tat ca module.
- "actors" (array): moi phan tu { "name", "desc" } - desc phai mo ta chi tiet vai tro, quyen han, cac thao tac co the lam. It nhat 4 actors.
- "modules" (array string): danh sach ten module, it nhat 6 modules. Moi module phai ro rang, khong trung lap.`;
}

function hrPrompt(): string {
  return `Ban la HR Manager & Team Lead. Phan vai tro phu hop cho tung thanh vien dua tren uu/nhuoc diem va kha nang.
${JSON_INSTRUCTION}
Tra object voi cac key BAT BUOC:
- "assignments" (array): moi phan tu { "name", "role", "reason", "modules" (array string), "workload" (number 0-100), "strengths", "weaknesses" }. Role phai cu the (vd: "Frontend Developer", "Backend Developer", "Database Engineer", "DevOps", "QA/Tester", "Tech Lead"). Reason giai thich tai sao chon vai tro nay. Modules la danh sach module nguoi nay phu trach.
- "coverage" (string): vi du "95%"
- "risks" (array): moi phan tu { "risk", "mitigation" }`;
}

function sprintPrompt(): string {
  return `Ban la Scrum Master. Chia du an thanh Sprint (moi Sprint 2 tuan), gan task cu the cho tung nguoi, dat deadline ro rang. Ngay bat dau tu hom nay.
${JSON_INSTRUCTION}
Tra object voi cac key BAT BUOC:
- "totalSprints" (number): thuong 2-4
- "sprintDuration" (string): "2 tuan"
- "sprints" (array): moi phan tu { "name" (vd "Sprint 1"), "start" (YYYY-MM-DD), "end" (YYYY-MM-DD), "goals" (array string), "tasks" (array: moi { "task", "assignee", "hours", "status": "todo" }), "color" (vd "#00d4aa") }
- "milestones" (array): moi phan tu { "date" (YYYY-MM-DD), "event" }`;
}

function architectPrompt(): string {
  return `Ban la Senior Software Architect. Thiet ke database schema, API endpoints, va folder structure CHI TIET va DAY DU de developer co the code ngay KHONG can hoi them.
${JSON_INSTRUCTION}
Tra object voi cac key BAT BUOC:
- "architectureDesc" (string): 6-8 cau mo ta kien truc he thong chi tiet. Ghi ro: cac layer (frontend-backend-db-cache), luong du lieu chinh, cach cac module giao tiep, security, scalability.
- "dbTables" (array): moi phan tu { "name" (vi du "users"), "columns" (array string, moi cot kem kieu du lieu va constraint vd "id: INT PRIMARY KEY AUTO_INCREMENT", "email: VARCHAR(255) UNIQUE NOT NULL", "created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP"), "relations" (array string vd "has_many: tasks", "belongs_to: department") }. It nhat 8 bang, moi bang it nhat 5 cot.
- "apiEndpoints" (array): moi phan tu { "method" ("GET"|"POST"|"PUT"|"DELETE"), "path" (vd "/api/users"), "desc" (mo ta chi tiet: input, output, auth required) }. It nhat 15 endpoints, phu cover tat ca CRUD operations.
- "folderStructure" (string): text tree cua cau truc thu muc CHI TIET, dung \\n cho xuong dong. Moi thu muc phu hop voi tech stack, bao gom: src/, tests/, docs/, config/`;
}

function umlPrompt(): string {
  return `Ban la UML Expert. Viet code Mermaid.js CHI TIET va DAY DU cho 4 bieu do. Moi bieu do phai co it nhat 8-12 node/actor de the hien day du he thong.
QUAN TRONG:
- KHONG dung [("text")] - dung ["text"] hoac ("text")
- KHONG dung markdown block ben trong string
- Moi string phai escape newline: dung \\n thay vi newline that
- Use Case: bat dau bang "graph TD"
- Class: bat dau bang "classDiagram"
- ERD: bat dau bang "erDiagram"
- Sequence: bat dau bang "sequenceDiagram"
${JSON_INSTRUCTION}
Tra object voi cac key BAT BUOC:
- "useCase" (string): mermaid code, ve day du cac actor va use case
- "classDiagram" (string): mermaid code, ve cac class chinh voi thuoc tinh va method
- "erd" (string): mermaid code, ve quan he giua cac bang DB
- "sequence" (string): mermaid code, ve luong xu ly chinh (vd: dang nhap, tao task)`;
}

function docsPrompt(): string {
  return `Ban la Technical Writer. Viet README.md, Coding Convention, va API Response Standard BANG TIENG VIET, chi tiet de developer moi co the lam viec ngay.
${JSON_INSTRUCTION}
Tra object voi cac key BAT BUOC:
- "readme" (string): noi dung README.md day du (gioi thieu, cai dat, chay, cau truc, huong dan code)
- "convention" (string): Coding Convention (ten bien, ten file, function, comment, git commit message)
- "apiStandard" (string): API Response Standard (format JSON, status code, error handling)`;
}

function gitPrompt(): string {
  return `Ban la DevOps Engineer. Viet git commands, branch strategy (Mermaid), va issue template.
QUAN TRONG:
- branchStrategy: Mermaid "graph LR", KHONG dung [("text")]
- issueTemplate: YAML front matter, escape newline bang \\n
${JSON_INSTRUCTION}
Tra object voi cac key BAT BUOC:
- "gitCommands" (string): cac lenh git setup (clone, branch, commit, push, pull request) - day du
- "branchStrategy" (string): code mermaid graph LR mo ta main/develop/Feature/HotFix
- "issueTemplate" (string): issue template YAML
- "repoUrl" (string): URL repo vi du https://github.com/org/project`;
}

function reviewerPrompt(): string {
  return `Ban la Quality Reviewer. Ban nhan toan bo ket qua cua 7 Agent va kiem tra dong bo, bo sung thong tin thieu, sua loi sai.
${JSON_INSTRUCTION}
Tra object voi cung cau truc giong input (analysis, hr, sprint, design, uml, docs, git). Chi sua nhung gi can sua, giu nguyen nhung gi da dung. Dam bao:
- HR assignments phu hop voi danh sach thanh vien that
- Sprint tasks gan dung assignee voi ten thanh vien
- DB tables va API endpoints phu hop voi features
- UML phu hop voi modules va actors`;
}

const TASK_GEN_PROMPT = `Ban la Senior Project Manager & Tech Lead. Ban tao todolist CHI TIET cho tung thanh vien de ho co the bat dau code ngay ma khong can hoi them.
Muc tieu: nguoi moi hoan toan khong biet gi cung hieu phai lam gi, vai tro gi, code nhu the nao de dong bo voi nguoi khac.
${JSON_INSTRUCTION}
Tra object voi key "tasks" (array). Moi task co:
- "assigneeName" (string): ten thanh vien (phai khop voi danh sach)
- "title" (string): ten cong vie cu the
- "description" (string): mo ta chi tiet 2-3 cau, noi ro phai lam gi
- "role" (string): vai tro trong task nay (vd "Backend Developer")
- "responsibilities" (array string): danh sach trach nhiem cu the (it nhat 3)
- "codeConventions" (array string): QUY UOC CODE ma nguoi nay phai tuan theo. VI DU: "Ham validateUser() phai tra ve boolean (true/false)", "API endpoint POST /api/login phai tra ve { success: boolean, token: string }", "Component UserCard phai nhan prop user: {id, name, email}". DAY LA PHAN QUAN TRONG NHAT de cac thanh vien dong bo code voi nhau.
- "dependencies" (string): phu thuoc vao task/nguoi khac (vd "Can User model cua A moi lam duoc")
- "acceptanceCriteria" (array string): tieu chi hoan thanh (it nhat 2)
- "deadline" (string YYYY-MM-DD): han chot
- "sprintName" (string): "Sprint 1" hoac "Sprint 2"...
- "hours" (number): so gio du kien
- "priority" (string): "P0" | "P1" | "P2"

Dam bao: MOI thanh vien co it nhat 3-5 task. Cac task phai lien ket voi nhau (codeConventions ghi ro rang de A biet B can gi). Phan bo cong bang.`;

const PROMPT_MAP: Record<SectionType, () => string> = {
  analysis: analystPrompt,
  hr: hrPrompt,
  sprint: sprintPrompt,
  design: architectPrompt,
  uml: umlPrompt,
  docs: docsPrompt,
  git: gitPrompt,
};

/* ===========================================================
   CONTEXT BUILDER
=========================================================== */
function buildCtx(
  key: SectionType,
  results: Partial<ProjectResult>,
  input: ProjectInput
): string {
  const members = input.members;
  const ms = members
    .map((m, i) => `${i + 1}. ${m.name} | Uu: ${m.strengths} | Nhuoc: ${m.weaknesses}`)
    .join("\n");

  const extra = input.extraInfo;
  let c = `Du an: ${input.topic}`;
  if (input.description) c += `\nMo ta: ${input.description}`;
  if (input.purpose) c += `\nMuc dich: ${input.purpose}`;
  if (extra.requirements?.length) c += `\nChuc nang yeu cau: ${extra.requirements.join("; ")}`;
  if (extra.specialReqs) c += `\nYeu cau dac biet: ${extra.specialReqs}`;
  if (extra.techPrefs?.length) c += `\nCong nghe: ${extra.techPrefs.join(", ")}`;
  if (extra.langPrefs?.length) c += `\nNgon ngu: ${extra.langPrefs.join(", ")}`;
  c += `\nThanh vien (${members.length}):\n${ms}`;

  switch (key) {
    case "hr":
      c += `\n\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      c += `\nFeatures: ${JSON.stringify((results.analysis?.features || []).map((f) => f.name))}`;
      break;
    case "sprint":
      c += `\n\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      c += `\nHR: ${JSON.stringify(
        (results.hr?.assignments || []).map((a) => ({ name: a.name, role: a.role, modules: a.modules }))
      )}`;
      break;
    case "design":
      c += `\n\nTech: ${JSON.stringify(results.analysis?.techStack)}`;
      c += `\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      c += `\nFeatures: ${JSON.stringify(
        (results.analysis?.features || []).map((f) => ({ name: f.name, module: f.module }))
      )}`;
      break;
    case "uml":
      c += `\n\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      c += `\nFeatures: ${JSON.stringify((results.analysis?.features || []).map((f) => f.name))}`;
      c += `\nActors: ${JSON.stringify((results.analysis?.actors || []).map((a) => a.name))}`;
      c += `\nDB: ${JSON.stringify((results.design?.dbTables || []).map((t) => t.name))}`;
      break;
    case "docs":
      c += `\n\nTech: ${JSON.stringify(results.analysis?.techStack)}`;
      c += `\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      c += `\nFolder: ${results.design?.folderStructure?.substring(0, 800) || "N/A"}`;
      break;
    case "git":
      c += `\n\nSlug: ${input.topic.toLowerCase().replace(/\s+/g, "-")}`;
      c += `\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      break;
  }
  return c;
}

/* ===========================================================
   FALLBACK
=========================================================== */
function fallback(
  key: SectionType,
  input: ProjectInput,
  results: Partial<ProjectResult>
): unknown {
  const d = new Date().toISOString().split("T")[0];
  const dEnd = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]; // +14 days
  const members = input.members;
  switch (key) {
    case "analysis":
      return {
        desc: `Du an: ${input.topic}. Mo ta mac dinh do Agent fail.`,
        techStack: {
          frontend: { name: "React", ver: "18", reason: "Pho bien, de hoc" },
          backend: { name: "Node.js", ver: "20", reason: "JavaScript runtime" },
          database: { name: "PostgreSQL", ver: "15", reason: "Relational DB" },
          cache: { name: "Redis", ver: "7", reason: "In-memory cache" },
          tools: [],
        },
        teamSize: members.length,
        estimatedDuration: "4-6 tuan",
        complexity: "Trung binh",
        features: input.extraInfo.requirements.map((r) => ({ name: r, module: "Core", pri: "P1" })),
        actors: [{ name: "User", desc: "Nguoi dung cuoi" }],
        modules: ["Auth", "Core", "Dashboard"], // sensible defaults instead of cross-section
      };
    case "hr":
      return {
        assignments: members.map((m) => ({
          name: m.name,
          role: "Developer",
          reason: "Mac dinh",
          modules: [],
          workload: Math.round(100 / Math.max(members.length, 1)),
          strengths: m.strengths,
          weaknesses: m.weaknesses,
        })),
        coverage: "N/A",
        risks: [{ risk: "Agent HR fail", mitigation: "Phan cong thu cong" }],
      };
    case "sprint":
      return {
        totalSprints: 2,
        sprintDuration: "2 tuan",
        sprints: [
          { name: "Sprint 1", start: d, end: dEnd, goals: ["Core features"], tasks: [], color: "#00d4aa" },
          { name: "Sprint 2", start: dEnd, end: new Date(Date.now() + 28 * 86400000).toISOString().split("T")[0], goals: ["Polish & Test"], tasks: [], color: "#38bdf8" },
        ],
        milestones: [{ date: dEnd, event: "Sprint 1 demo" }],
      };
    case "design":
      return { architectureDesc: "N/A", dbTables: [], apiEndpoints: [], folderStructure: "N/A" };
    case "uml":
      return { useCase: "", classDiagram: "", erd: "", sequence: "" };
    case "docs":
      return {
        readme: `# ${input.topic}\n\nTai lieu chua duoc tao tu dong.`,
        convention: "",
        apiStandard: "",
      };
    case "git":
      return {
        gitCommands: "",
        branchStrategy: "",
        issueTemplate: "",
        repoUrl: "https://github.com/your-org/project",
      };
    default:
      return null;
  }
}

/* ===========================================================
   REVIEWER SUMMARY
=========================================================== */
function buildReviewSummary(results: ProjectResult, topic: string) {
  return {
    topic,
    analysis: {
      modules: results.analysis?.modules || [],
      featureCount: (results.analysis?.features || []).length,
      actorNames: (results.analysis?.actors || []).map((a) => a.name),
      tech: {
        fe: results.analysis?.techStack?.frontend?.name,
        be: results.analysis?.techStack?.backend?.name,
        db: results.analysis?.techStack?.database?.name,
      },
    },
    hr: {
      assignments: (results.hr?.assignments || []).map((a) => ({
        name: a.name,
        role: a.role,
        modules: a.modules,
      })),
    },
    sprint: {
      count: results.sprint?.totalSprints,
      tasks: (results.sprint?.sprints || []).reduce((s, sp) => s + (sp.tasks?.length || 0), 0),
    },
    design: {
      tables: (results.design?.dbTables || []).map((t) => t.name),
      apiCount: (results.design?.apiEndpoints || []).length,
    },
    uml: {
      hasUseCase: !!results.uml?.useCase,
      hasClass: !!results.uml?.classDiagram,
      hasERD: !!results.uml?.erd,
      hasSequence: !!results.uml?.sequence,
    },
    docs: {
      hasReadme: !!results.docs?.readme,
      hasConvention: !!results.docs?.convention,
      hasApiStandard: !!results.docs?.apiStandard,
    },
    git: {
      hasCommands: !!results.git?.gitCommands,
      hasBranch: !!results.git?.branchStrategy,
    },
  };
}

/* ===========================================================
   MAIN PIPELINE
   onProgress streams SSE-style events to the API route.
=========================================================== */
export async function runPipeline(
  input: ProjectInput,
  onProgress?: (ev: {
    type: string;
    id: string;
    name: string;
    index: number;
    total: number;
    error?: string;
  }) => void
): Promise<ProjectResult> {
  const results: Partial<ProjectResult> = {};
  const failed: AgentDef[] = [];
  const t0 = Date.now();
  const total = AGENTS.length + 1; // +1 reviewer

  // ===== PHASE 1: 7 Agents =====
  for (let i = 0; i < AGENTS.length; i++) {
    const ag = AGENTS[i];
    onProgress?.({ type: "agent_start", id: ag.id, name: ag.name, index: i, total });
    console.log(`\n>> [AGENT-${ag.id}] ${ag.name}`);
    console.log(`   Models: ${ag.models.join(" → ")}`);
    console.log(`   Temp: ${ag.temp}`);

    const ctx = buildCtx(ag.key, results, input);
    const res = await callAndParse(ag.models, PROMPT_MAP[ag.key](), ctx, ag.temp);

    if (res && isValidSchema(res.data, ag.key)) {
      (results as Record<string, unknown>)[ag.key] = res.data;
      onProgress?.({ type: "agent_done", id: ag.id, name: ag.name, index: i, total });
      console.log(`✓ [AGENT-${ag.id}] ${ag.name} → ${res.model}`);
    } else if (res) {
      console.log(`⚠ [AGENT-${ag.id}] ${ag.name} → Schema loi, van luu`);
      (results as Record<string, unknown>)[ag.key] = res.data;
      onProgress?.({ type: "agent_done", id: ag.id, name: ag.name, index: i, total });
    } else {
      failed.push(ag);
      onProgress?.({ type: "agent_fail", id: ag.id, name: ag.name, index: i, total });
      console.log(`✗ [AGENT-${ag.id}] ${ag.name} → TAT CA MODEL FAIL`);
    }
  }

  // ===== PHASE 2: Retry failed agents =====
  if (failed.length > 0) {
    console.log(`\n>> RETRY: ${failed.length} Agent that bai...`);
    for (const ag of failed) {
      onProgress?.({
        type: "agent_start",
        id: ag.id,
        name: `${ag.name} (Retry)`,
        index: 7,
        total,
      });
      console.log(`   ⏳ Doi 5s truoc retry ${ag.name}...`);
      await wait(5000);

      const ctx = buildCtx(ag.key, results, input);
      const res = await callAndParse(ag.models, PROMPT_MAP[ag.key](), ctx, ag.temp);

      if (res && isValidSchema(res.data, ag.key)) {
        (results as Record<string, unknown>)[ag.key] = res.data;
        onProgress?.({
          type: "agent_done",
          id: ag.id,
          name: `${ag.name} (Retry)`,
          index: 7,
          total,
        });
        console.log(`✓ [RETRY-${ag.id}] ${ag.name} → ${res.model}`);
      } else if (res) {
        (results as Record<string, unknown>)[ag.key] = res.data;
        onProgress?.({ type: "agent_done", id: ag.id, name: `${ag.name} (Retry)`, index: 7, total });
      } else {
        onProgress?.({ type: "agent_fail", id: ag.id, name: `${ag.name} (Retry)`, index: 7, total });
        console.log(`✗ [RETRY-${ag.id}] ${ag.name} → VAN FAIL`);
      }
    }
  }

  // ===== PHASE 3: required check + fallback =====
  const requiredAgents = AGENTS.filter((a) => a.required);
  const reqMiss = requiredAgents.filter((a) => !results[a.key]);
  if (reqMiss.length === requiredAgents.length) {
    throw new Error("Tat ca Agent bat buoc (Analyst + Architect) deu fail. Thu lai sau 30 giay.");
  }

  for (const ag of AGENTS) {
    if (!results[ag.key]) {
      console.log(`>> FALLBACK: ${ag.name}`);
      (results as Record<string, unknown>)[ag.key] = fallback(ag.key, input, results);
    }
  }

  // ===== PHASE 4: Quality Reviewer =====
  onProgress?.({
    type: "agent_start",
    id: "08",
    name: "Quality Reviewer",
    index: 7,
    total,
  });
  console.log("\n>> [AGENT-08] Quality Reviewer");

  try {
    // Send FULL results (not just summary) so reviewer can actually fix content.
    // Truncate to ~12000 chars to stay within token limits.
    const fullResults = JSON.stringify(results).substring(0, 12000);
    const res = await callAndParse(
      REVIEWER_MODELS,
      reviewerPrompt(),
      `Du an: ${input.topic}\n\nKET QA DAY DU CUA 7 AGENT (JSON):\n${fullResults}`,
      0.1
    );

    if (res && res.data && !isEmptyObj(res.data)) {
      const rev = res.data as Record<string, unknown>;
      // Safe merge: keep original if reviewer field is empty/invalid
      for (const key of Object.keys(results) as SectionType[]) {
        const rv = rev[key];
        if (rv == null || isEmptyObj(rv)) {
          rev[key] = results[key];
        } else if (results[key] && !isEmptyObj(results[key]) && !isValidSchema(rv, key)) {
          rev[key] = results[key];
        }
      }
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      onProgress?.({ type: "agent_done", id: "08", name: "Quality Reviewer", index: 7, total });
      console.log(`✓ [AGENT-08] Reviewer → ${res.model} (${sec}s tong)`);
      return rev as unknown as ProjectResult;
    }
  } catch (e) {
    console.log(`✗ [AGENT-08] Reviewer fail: ${(e as Error).message?.substring(0, 100)}`);
  }

  onProgress?.({ type: "agent_fail", id: "08", name: "Quality Reviewer", index: 7, total });
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`>> Tra ket qua goc (${sec}s)\n`);
  return results as ProjectResult;
}

/* ===========================================================
   REFINE: re-generate sections from leader edits + chat
=========================================================== */
export async function refineSections(
  input: ProjectInput,
  current: ProjectResult,
  editRequests: { section: SectionType; change: string }[],
  chatDiscussion: string,
  onProgress?: (section: SectionType, done: boolean) => void
): Promise<ProjectResult> {
  const refined: ProjectResult = { ...current };
  const base = buildCtx("analysis", current, input);
  const discussion = chatDiscussion ? `\n\nCUOC THAO LUAN CUA NHOM:\n${chatDiscussion}` : "";
  const edits = editRequests.length
    ? `\n\nYEU CAU CHINH SUA CUA NHOM TRUONG:\n${editRequests
        .map((e) => `- [${e.section}]: ${e.change}`)
        .join("\n")}`
    : "";

  for (const ag of AGENTS) {
    onProgress?.(ag.key, false);
    try {
      const sys =
        PROMPT_MAP[ag.key]() +
        `\n\nNhiem vu dac biet: Ban dang CHINH SUA lai phan "${ag.key}" dua tren yeu cau cua nhom truong va cuoc thao luan. Giu nguyen cau truc JSON, chi sua noi dung cho phu hop voi y nguoi dung. Dam bao dong bo voi cac phan khac.`;
      const user = `${base}${edits}${discussion}\n\nNOI DUNG HIEN TAI cua phan ${ag.key}:\n${JSON.stringify(
        current[ag.key]
      ).substring(0, 4000)}\n\nHay tra lai phan ${ag.key} da chinh sua (JSON day du).`;
      const res = await callAndParse(ag.models, sys, user, ag.temp);
      if (res && isValidSchema(res.data, ag.key)) {
        (refined as Record<string, unknown>)[ag.key] = res.data;
      }
    } catch {
      /* keep current */
    }
    onProgress?.(ag.key, true);
  }
  return refined;
}

/* ===========================================================
   TASK GENERATION
=========================================================== */
export async function generateTasks(
  input: ProjectInput,
  result: ProjectResult,
  onProgress?: (done: boolean) => void
): Promise<TaskItem[]> {
  onProgress?.(false);
  const base = buildCtx("analysis", result, input);
  const context = `${base}

PHAN TICH DU AN:
${JSON.stringify(result.analysis).substring(0, 2500)}

PHAN NHAN SU:
${JSON.stringify(result.hr).substring(0, 1500)}

SPRINT PLANNING:
${JSON.stringify(result.sprint).substring(0, 2500)}

THIET KE HE THONG:
${JSON.stringify(result.design).substring(0, 2500)}

Hay tao todolist chi tiet cho tung thanh vien.`;

  try {
    const res = await callAndParse(TASK_GEN_MODELS, TASK_GEN_PROMPT, context, 0.25);
    onProgress?.(true);
    if (res && res.data) {
      const data = res.data as { tasks?: TaskItem[] };
      if (data.tasks && Array.isArray(data.tasks)) return data.tasks;
    }
    return [];
  } catch {
    onProgress?.(true);
    const today = new Date();
    const tasks: TaskItem[] = [];
    for (const m of input.members) {
      const role = result.hr.assignments.find((a) => a.name === m.name)?.role || "Developer";
      tasks.push({
        assigneeName: m.name,
        title: "Setup moi truong phat trien",
        description: "Cai dat va cau hinh moi truong phat trien theo tech stack.",
        role,
        responsibilities: ["Cai dat dependencies", "Cau hinh IDE", "Clone repository"],
        codeConventions: ["Tuan thu coding convention trong tai lieu"],
        dependencies: "Khong",
        acceptanceCriteria: ["Co the chay project locally"],
        deadline: new Date(today.getTime() + 7 * 86400000).toISOString().split("T")[0],
        sprintName: "Sprint 1",
        status: "todo",
        hours: 8,
        priority: "P0",
      });
    }
    return tasks;
  }
}

/* ===========================================================
   CHAT ASSISTANT
=========================================================== */
export async function chatAssistant(
  input: ProjectInput,
  result: ProjectResult,
  recentMessages: string
): Promise<string> {
  // Chat replies are plain text, NOT JSON. Use callModel directly (not callAndParse)
  // to avoid wasting OpenRouter calls on failed JSON parsing + AI self-fix.
  const sys = `Ban la NEXUS AI Assistant trong phong chat cua du an "${input.topic}". Ban giup nhom ra quyet dinh, tong hop y kien, va de xuat chinh sua. Tra loi ngan gon, bang tieng Viet. Neu ai do de xuat chinh sua, ban goi y nhom truong them vao danh sach yeu cau chinh sua.`;
  const usr = `Thong tin du an:
- Tech: ${result.analysis.techStack.frontend.name} + ${result.analysis.techStack.backend.name} + ${result.analysis.techStack.database.name}
- Modules: ${result.analysis.modules.join(", ")}
- Thanh vien: ${input.members.map((m) => m.name).join(", ")}

TIN NHAN GAN DAY:
${recentMessages}

Hay phan hoi / tong hop / goi y.`;

  // Try each chat model until one succeeds
  for (const model of CHAT_MODELS) {
    try {
      return await callModel(model, sys, usr, 0.5);
    } catch (err) {
      const e = err as OpenRouterError;
      // 429/5xx: try next model. 4xx (non-429): try next model too.
      console.log(`  [CHAT] ${model} failed: ${e.status || e.code} — trying next`);
    }
  }
  return "Xin loi, toi khong the phan hoi luc nay.";
}
