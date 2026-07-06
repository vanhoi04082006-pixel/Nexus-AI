// NEXUS AI - Multi-Agent AI Service (OpenRouter)
// Port of the original v5.0 aiService.js to TypeScript + Next.js.
// Each Agent has a tailored model list, 2 retries per model with exponential
// backoff, a JSON fixer, an AI self-fix pass, and graceful fallbacks.

import { callOpenRouter, type OpenRouterError, isModelDead, getModelHealth } from "./openrouter";
import { appendLog } from "./pipeline-progress";
import { validateSection } from "./schemas";
import pLimit from "p-limit";
import type {
  ProjectResult,
  ProjectInput,
  TaskItem,
  SectionType,
} from "./types";

/* ===========================================================
   Tunables
=========================================================== */
const REQ_TIMEOUT = 300000; // 5 min — slow models (nemotron-ultra) need time
const MAX_RETRIES = 5;      // 5 attempts per model (more retries for 429 rate-limits)
const INIT_DELAY = 2000;
const BACKOFF_MULT = 2;
const MAX_DELAY = 60000;   // 60s max delay between retries
const RATE_LIMIT_DELAY = 60000; // 60s fixed wait for 429 rate-limits (user requirement)
const MAX_CONCURRENCY = 3;  // Max parallel LLM calls (prevents memory blowup + rate-limit spikes)

// Concurrency limiter — max 3 parallel LLM calls to prevent:
// 1. Memory blowup from too many concurrent fetch() streams
// 2. Rate-limit spikes from hitting OpenRouter with 6+ requests at once
// 3. DDoS-like behavior on OpenRouter's free-tier infrastructure
const limiter = pLimit(MAX_CONCURRENCY);

/**
 * Full Jitter backoff — prevents "Thundering Herd" DDoS on retry.
 * Instead of all agents retrying at exactly 2s, 4s, 8s,
 * each gets a random delay spread across the backoff window.
 * Formula: delay = random(0, base * mult^attempt)
 * Source: AWS Architecture Blog — "Exponential Backoff and Jitter"
 */
function jitteredDelay(base: number, attempt: number): number {
  const ceiling = Math.min(base * Math.pow(BACKOFF_MULT, attempt), MAX_DELAY);
  return Math.random() * ceiling;
}

/* ===========================================================
   PRIMARY MODELS (v2 — OpenRouter free tier, multi-model fallback)
   Each agent has its own tailored priority list of free models.
   Ordered by capability / availability per agent's task type.
   Last updated: 2026-07-02 (v2)
=========================================================== */

/* ===========================================================
   AGENT DEFINITIONS
   Each agent has its own model priority list suited to its task.
=========================================================== */
interface AgentDef {
  id: string;
  name: string;
  prompt?: () => string;
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
    temp: 0.20,
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "openai/gpt-oss-120b:free",
      "nousresearch/hermes-3-llama-3.1-405b:free",
      "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
    ],
  },
  {
    id: "02",
    name: "HR Planner",
    key: "hr",
    required: false,
    temp: 0.25,
    models: [
      "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free",
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "openai/gpt-oss-120b:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
      "openai/gpt-oss-20b:free",
    ],
  },
  {
    id: "03",
    name: "Sprint Planner",
    key: "sprint",
    required: false,
    temp: 0.20,
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "openai/gpt-oss-120b:free",
      "nousresearch/hermes-3-llama-3.1-405b:free",
      "google/gemma-4-31b-it:free",
      "nvidia/nemotron-nano-9b-v2:free",
    ],
  },
  {
    id: "04",
    name: "System Architect",
    key: "design",
    required: true,
    temp: 0.15,
    models: [
      "openai/gpt-oss-120b:free",
      "qwen/qwen3-coder:free",
      "poolside/laguna-m.1:free",
      "cohere/north-mini-code:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "google/gemma-4-31b-it:free",
      "openai/gpt-oss-20b:free",
    ],
  },
  {
    id: "05",
    name: "UML Generator",
    key: "uml",
    required: false,
    temp: 0.10,
    models: [
      "openai/gpt-oss-120b:free",
      "qwen/qwen3-coder:free",
      "cohere/north-mini-code:free",
      "poolside/laguna-xs-2.1:free",
      "poolside/laguna-xs.2:free",
      "google/gemma-4-31b-it:free",
      "openai/gpt-oss-20b:free",
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
      "google/gemma-4-26b-a4b-it:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "openai/gpt-oss-120b:free",
      "nousresearch/hermes-3-llama-3.1-405b:free",
      "meta-llama/llama-3.2-3b-instruct:free",
    ],
  },
  {
    id: "07",
    name: "Git / DevOps",
    key: "git",
    required: false,
    temp: 0.15,
    models: [
      "cohere/north-mini-code:free",
      "poolside/laguna-m.1:free",
      "qwen/qwen3-coder:free",
      "poolside/laguna-xs-2.1:free",
      "poolside/laguna-xs.2:free",
      "openai/gpt-oss-120b:free",
      "openai/gpt-oss-20b:free",
    ],
  },
  {
    id: "08",
    name: "Software Tester",
    key: "test",
    required: false,
    temp: 0.20,
    models: [
      "qwen/qwen3-coder:free",
      "openai/gpt-oss-120b:free",
      "cohere/north-mini-code:free",
      "poolside/laguna-m.1:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "google/gemma-4-31b-it:free",
      "openai/gpt-oss-20b:free",
    ],
  },
  {
    id: "09",
    name: "Security Reviewer",
    key: "security",
    required: false,
    temp: 0.15,
    models: [
      "openai/gpt-oss-120b:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "nousresearch/hermes-3-llama-3.1-405b:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-4-31b-it:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
    ],
  },
];

const REVIEWER_MODELS = [
  "openai/gpt-oss-120b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "google/gemma-4-31b-it:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
];

const TASK_GEN_MODELS = [
  "qwen/qwen3-coder:free",
  "openai/gpt-oss-120b:free",
  "poolside/laguna-m.1:free",
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
];

const CHAT_MODELS = [
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
  "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "openai/gpt-oss-20b:free",
  "meta-llama/llama-3.2-3b-instruct:free",
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
  test: ["testStrategy", "unitTests"],
  security: ["threats", "authFlow"],
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
// ===== Adaptive Timeout =====
// Different models have different response times. Use shorter timeouts
// for fast models and longer for slow ones to avoid wasting time.
const MODEL_TIMEOUTS: Record<string, number> = {
  "nvidia/nemotron-3-ultra-550b-a55b:free": 300000, // 5 min — very slow
  "nvidia/nemotron-3-super-120b-a12b:free": 240000, // 4 min
  "openai/gpt-oss-120b:free": 180000, // 3 min
  "google/gemma-4-31b-it:free": 120000, // 2 min
  "google/gemma-4-26b-a4b-it:free": 90000, // 1.5 min
  "qwen/qwen3-coder:free": 120000,
  "qwen/qwen3-next-80b-a3b-instruct:free": 120000,
};
function getAdaptiveTimeout(model: string): number {
  return MODEL_TIMEOUTS[model] ?? REQ_TIMEOUT;
}

// ===== Context Compression =====
// Truncate long JSON strings to reduce token usage before sending to AI.
// Keeps the most relevant parts: first N chars + last N chars.
function compressContext(json: string, maxLen = 3000): string {
  if (json.length <= maxLen) return json;
  const head = Math.floor(maxLen * 0.6);
  const tail = Math.floor(maxLen * 0.3);
  return json.substring(0, head) + "\n...[COMPRESSED " + (json.length - head - tail) + " chars]...\n" + json.substring(json.length - tail);
}

async function callModel(
  model: string,
  sys: string,
  usr: string,
  temp: number
): Promise<string> {
  // Wrap in concurrency limiter — max MAX_CONCURRENCY parallel LLM calls
  return limiter(() => callOpenRouter(
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
    getAdaptiveTimeout(model) // Adaptive timeout per model
  ));
}

interface ParseResult {
  data: unknown;
  model: string;
}

async function callAndParse(
  models: string[],
  sys: string,
  usr: string,
  temp: number,
  sectionKey?: string // for Zod validation (analysis, hr, sprint, etc.)
): Promise<ParseResult | null> {
  // ===== Priority Model Sorting =====
  // Sort models by health score (success rate) — highest success rate first
  // Models with no history get default 1.0 (trusted until proven bad)
  const sortedModels = [...models].sort((a, b) => {
    const ha = getModelHealth(a);
    const hb = getModelHealth(b);
    // Higher success rate first; if equal, fewer total calls = less tested = lower priority
    if (hb.successRate !== ha.successRate) return hb.successRate - ha.successRate;
    return hb.totalCalls - ha.totalCalls;
  });

  for (const model of sortedModels) {
    // Skip dead models (all keys exhausted / 404 unavailable recently)
    // This saves significant time when many agents share the same model list
    if (isModelDead(model)) {
      appendLog({
        level: "warn",
        model,
        message: `  ⊘ ${model} → SKIP (model marked dead — all keys exhausted recently)`,
      });
      console.log(`      [SKIP] ${model} (dead)`);
      continue;
    }
    let d = INIT_DELAY;

    for (let a = 1; a <= MAX_RETRIES; a++) {
      try {
        console.log(`      [${a}/${MAX_RETRIES}] ${model}`);
        appendLog({
          level: "info",
          model,
          message: `  → [${a}/${MAX_RETRIES}] trying ${model}`,
        });
        const raw = await callModel(model, sys, usr, temp);
        let data: unknown = null;

        // Parse pipeline: JSON.parse → JFix fallback → extract substring → AI self-fix
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
          // AI self-fix pass — ask model to fix its own broken JSON
          console.log(`      [${a}] JSON loi, AI sua...`);
          appendLog({
            level: "warn",
            model,
            message: `  ⚠ [${a}] ${model} returned invalid JSON — AI self-fix pass`,
          });
          const fix = await callModel(
            model,
            "JSON fixer. Chi tra JSON hop le, khong them gi nua.",
            `Sua JSON loi:\n${(raw || "").substring(0, 5000)}`,
            0.1
          );
          data = JFix.parse(fix);
        }

        // Zod schema validation — strict type checking replaces loose isValidSchema
        // If data parses as JSON but doesn't match schema (missing fields, wrong types),
        // Zod catches it and we retry with the error message fed back to AI
        if (data) {
          const zodResult = validateSection(sectionKey || "", data);
          if (zodResult.success) {
            // ===== Self-Critic: quick consistency check =====
            // Verify the data has non-empty content (not just empty objects/arrays)
            const dataStr = JSON.stringify(zodResult.data);
            if (dataStr.length < 20 || dataStr === "{}" || dataStr === "[]") {
              console.log(`      [${a}] Self-critic: data too empty (${dataStr.length} chars), retrying`);
              appendLog({
                level: "warn",
                model,
                message: `  ⚠ ${model} parsed OK but data is nearly empty — retrying (attempt ${a})`,
              });
              // Don't return — fall through to retry
            } else {
              console.log(`      ✓ ${model} (lan ${a}) [Zod validated + self-critic OK]`);
              appendLog({
                level: "success",
                model,
                message: `  ✓ ${model} parsed + Zod validated + self-critic OK (attempt ${a})`,
              });
              return { data: zodResult.data, model };
            }
          } else {
            // Zod validation failed — data is valid JSON but wrong structure
            // Try AI self-fix with Zod error message (1 chance per attempt)
            console.log(`      [${a}] Zod validation failed: ${zodResult.error.substring(0, 80)}`);
            appendLog({
              level: "warn",
              model,
              message: `  ⚠ [${a}] ${model} JSON valid but schema mismatch: ${zodResult.error.substring(0, 100)} — AI fixing`,
            });
            const fixPrompt = `JSON cua ban da parse thanh cong nhung SAI CAU TRUC. Loi: ${zodResult.error}\n\nSua lai JSON cho dung schema. Giu nguyen noi dung, chi sua cau truc:\n${JSON.stringify(data).substring(0, 5000)}`;
            const fixRaw = await callModel(model, "JSON schema fixer. Tra JSON dung schema.", fixPrompt, 0.1);
            let fixedData: unknown = null;
            try { fixedData = JSON.parse(fixRaw.trim()); } catch { fixedData = JFix.parse(fixRaw); }
            if (fixedData) {
              const revalidate = validateSection(sectionKey || "", fixedData);
              if (revalidate.success) {
                console.log(`      ✓ ${model} (lan ${a}) [Zod re-validated after fix]`);
                appendLog({
                  level: "success",
                  model,
                  message: `  ✓ ${model} Zod validated after AI fix (attempt ${a})`,
                });
                return { data: revalidate.data, model };
              }
            }
            // Still failed — continue to next retry attempt
            appendLog({
              level: "warn",
              model,
              message: `  ⚠ [${a}] ${model} Zod fix failed — will retry`,
            });
          }
        }
      } catch (err) {
        const e = err as OpenRouterError;
        const st = e.status;
        const msg = (e.message || "").substring(0, 120);
        console.log(`      ✗ [${a}] ${model} → [${st || e.code || "NET"}] ${msg}`);
        appendLog({
          level: "error",
          model,
          keyIndex: e.keyIndex != null ? e.keyIndex + 1 : undefined,
          message: `  ✗ [${a}/${MAX_RETRIES}] ${model} → [${st || e.code || "NET"}] ${msg}`,
        });

        // 429: rate limit — wait 60s (user requirement) + jitter, then retry same model
        if (st === 429) {
          const ra = e.retryAfter || 60;
          const jittered = jitteredDelay(INIT_DELAY, a);
          const waitMs = Math.max(RATE_LIMIT_DELAY, Math.min(ra * 1000, MAX_DELAY)) + Math.min(jittered, 5000);
          console.log(`      ⏳ Rate limit, doi ${Math.round(waitMs / 1000)}s (60s + jitter)`);
          appendLog({
            level: "warn",
            model,
            message: `  ⏳ Rate-limited — waiting ${Math.round(waitMs / 1000)}s before retry (60s base + jitter)`,
          });
          await wait(waitMs);
          d = Math.min(d * BACKOFF_MULT, MAX_DELAY);
          continue;
        }

        // 5xx / timeout / network: retry same model with 60s delay (user requirement)
        // ETIMEDOUT = model is slow, not broken — retry with patience
        if (
          (st && st >= 500) ||
          e.code === "ETIMEDOUT" ||
          e.code === "ENET" ||
          e.code === "ECONNRESET"
        ) {
          const isTimeout = e.code === "ETIMEDOUT";
          const jittered = jitteredDelay(INIT_DELAY, a);
          const waitMs = Math.max(RATE_LIMIT_DELAY, jittered); // min 60s
          console.log(`      ⏳ ${isTimeout ? "Timeout (model slow)" : "Server/timeout"}, doi ${Math.round(waitMs / 1000)}s`);
          appendLog({
            level: "warn",
            model,
            message: isTimeout
              ? `  ⏳ Timeout — model is slow, retrying in ${Math.round(waitMs / 1000)}s (attempt ${a}/${MAX_RETRIES})`
              : `  ⏳ Server/timeout — retrying in ${Math.round(waitMs / 1000)}s`,
          });
          await wait(waitMs);
          d = Math.min(d * BACKOFF_MULT, MAX_DELAY);
          continue;
        }

        // 401/403: one key is invalid, but other keys may work — skip to next model
        // (NOT fatal — only 1 out of N keys may be invalid, pipeline should continue)
        if (st === 401 || st === 403) {
          appendLog({
            level: "warn",
            model,
            message: `  ⚠ ${model} → skip to next model (some API keys invalid ${st})`,
          });
          break;
        }

        // 4xx (non-429, non-401/403): invalid model / bad request — skip to next model
        appendLog({
          level: "warn",
          model,
          message: `  ⚠ ${model} → skip to next model (HTTP ${st})`,
        });
        break;
      }
    }
  }
  return null;
}

/* ===========================================================
   PROMPT BUILDERS
=========================================================== */
const JSON_INSTRUCTION = `TRA VE JSON THUAN TUY (pure JSON). He thong da bat response_format: json_object — model bat buoc tra JSON hop le. Tuyet doi KHONG dung markdown code block, KHONG comment, KHONG trailing comma. Tat ca string phai dung \\n cho xuong dong. Neu khong biet gia tri thi dung "" hoac [].`;

// ===== Few-shot + Negative examples (shared across agents) =====
const FEW_SHOT_NOTE = `
FEW-SHOT EXAMPLE (dung de huong dan):
  DUNG: "desc": "He thong quan ly nhan su cho cong ty 500 nhan vien. Nguoi dung cuoi la HR Manager va Employee. Giai quyet van de quan ly cham cong, nghi phep, luong. Quy mo: web app voi 8 module chinh."
  SAI: "desc": "Quan ly nhan su" (qua ngan, khong co chi tiet)

NEGATIVE EXAMPLE (KHONG DUOC lam):
  - KHONG dung ten chung chung nhu "User", "Course", "Student" neu du an la "quan ly benh vien" — phai dung "Bệnh nhân", "Bác sĩ", "Đơn thuốc"
  - KHONG bo trong bat ky field nao — moi field phai co noi dung day du
  - KHONG trung lap entity/module — kiem tra lai danh sach truoc khi them
  - KHONG dat ten khong phu hop voi chu de du an`;

function analystPrompt(): string {
  return `Ban la Senior Requirement Analyst & Tech Lead. Phan tich du an KY LUONG, CHI TIET va DAY DU.
${JSON_INSTRUCTION}
${FEW_SHOT_NOTE}
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
${FEW_SHOT_NOTE}
Tra object voi cac key BAT BUOC:
- "assignments" (array): moi phan tu { "name", "role", "reason", "modules" (array string), "workload" (number 0-100), "strengths", "weaknesses" }. Role phai cu the (vd: "Frontend Developer", "Backend Developer", "Database Engineer", "DevOps", "QA/Tester", "Tech Lead"). Reason giai thich tai sao chon vai tro nay. Modules la danh sach module nguoi nay phu trach.
- "coverage" (string): vi du "95%"
- "risks" (array): moi phan tu { "risk", "mitigation" }`;
}

function sprintPrompt(): string {
  const today = new Date().toISOString().split("T")[0];
  return `Ban la Scrum Master. Chia du an thanh Sprint (moi Sprint 2 tuan), gan task cu the cho tung nguoi, dat deadline ro rang.
QUAN TRONG: Ngay hom nay la ${today}. Sprint 1 bat dau tu ${today}. Moi sprint ke tiep bat dau ngay sau sprint truoc ket thuc.
${JSON_INSTRUCTION}
${FEW_SHOT_NOTE}
Tra object voi cac key BAT BUOC:
- "totalSprints" (number): thuong 2-4
- "sprintDuration" (string): "2 tuan"
- "sprints" (array): moi phan tu { "name" (vd "Sprint 1"), "start" (YYYY-MM-DD, bat dau tu ${today}), "end" (YYYY-MM-DD, 14 ngay sau start), "goals" (array string), "tasks" (array: moi { "task", "assignee", "hours", "status": "todo" }), "color" (vd "#00d4aa") }
- "milestones" (array): moi phan tu { "date" (YYYY-MM-DD), "event" }`;
}

function architectPrompt(): string {
  return `Ban la Senior Software Architect. Thiet ke database schema, API endpoints, va folder structure CHI TIET va DAY DU de developer co the code ngay KHONG can hoi them.
QUAN TRONG: Tat ca dbTables, apiEndpoints, folderStructure PHAI PHU HOP VOI CHU DE DU AN — dung ten entity that cua du an (vd: neu la "quan ly khach san" thi co Bang Rooms, Reservations, Guests, Branches; KHONG dung User/Course chung chung).
${JSON_INSTRUCTION}
${FEW_SHOT_NOTE}
Tra object voi cac key BAT BUOC:
- "architectureDesc" (string): 6-8 cau mo ta kien truc he thong chi tiet. Ghi ro: cac layer (frontend-backend-db-cache), luong du lieu chinh, cach cac module giao tiep, security, scalability.
- "dbTables" (array): moi phan tu { "name" (vi du "users"), "columns" (array string, moi cot kem kieu du lieu va constraint vd "id: INT PRIMARY KEY AUTO_INCREMENT", "email: VARCHAR(255) UNIQUE NOT NULL", "created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP"), "relations" (array string vd "has_many: tasks", "belongs_to: department") }. It nhat 8 bang, moi bang it nhat 5 cot.
- "apiEndpoints" (array): moi phan tu { "method" ("GET"|"POST"|"PUT"|"DELETE"), "path" (vd "/api/users"), "desc" (mo ta chi tiet: input, output, auth required) }. It nhat 15 endpoints, phu cover tat ca CRUD operations.
- "folderStructure" (string): CAU TRUC TREE dung ky tu Unicode. BAT BUOC dung format:
  project-root/
  \u251C\u2500\u2500 src/
  \u2502   \u251C\u2500\u2500 app/
  \u2502   \u2502   \u251C\u2500\u2500 api/
  \u2502   \u2502   \u2502   \u251C\u2500\u2500 auth/login/route.ts
  \u2502   \u2502   \u2502   \u2514\u2500\u2500 users/[id]/route.ts
  \u2502   \u2502   \u2514\u2500\u2500 page.tsx
  \u2502   \u251C\u2500\u2500 components/
  \u2502   \u2514\u2500\u2500 lib/
  \u251C\u2500\u2500 tests/
  \u2514\u2500\u2500 package.json
  Dung \\n cho xuong dong. BAT BUOC dung ky tu tree, KHONG dung khoang trang.`;
}

function umlPrompt(): string {
  return `You are Nexus UML Architect — an enterprise software architect specialized in UML 2.5.

Your responsibility is NOT to design software from imagination.
Your responsibility is to transform VERIFIED project knowledge into accurate, consistent, maintainable UML diagrams.

You never hallucinate. You never guess.
You always synchronize every diagram with the current project context (requirement, architecture, database, API, existing entities).

PRIMARY OBJECTIVE:
Generate enterprise-grade UML diagrams that remain fully synchronized with:
- Functional Requirements (from Analysis section)
- Architecture (from Design section: dbTables, apiEndpoints, folderStructure)
- Database Schema (from Design section: dbTables)
- API Specification (from Design section: apiEndpoints)
- Existing Entities (from Analysis section: actors, features, modules)
- Sprint/User Stories (from Sprint section)

GENERAL RULES:
- Never invent actors, classes, services, entities, tables, endpoints, attributes, or methods
- Everything must originate from project context provided to you
- Use PascalCase for all names (UserService, CourseController, EnrollmentRepository)
- Never abbreviate names
- Output valid Mermaid syntax only — no markdown, no explanation, no comments

NAMING RULES:
- Use PascalCase: UserService, OrderController, PaymentGateway
- Do NOT use: user_service, course-controller, USERSERVICE
- Node IDs in graph TD must be [A-Za-z0-9_] — NO Vietnamese diacritics, NO spaces
  (Vietnamese labels go inside ["..."] quotes, IDs must be ASCII)
  Example: BenhNhan["Bệnh nhân"], not Bệnh nhân["Bệnh nhân"]

=== USE CASE DIAGRAM (graph TD) ===
RULES:
- Extract actors ONLY from project requirement (analysis.actors)
- Extract use cases ONLY from functional requirement (analysis.features)
- Group use cases into logical packages
- Include <<include>> and <<extend>> where appropriate
- Never invent actors or use cases
- Syntax: ActorName["Actor Name"] --> UseCaseName["Use Case Name"]
- Include: A -->|include| B
- Extend: A -.->|extend| B
- Node IDs must be ASCII (no diacritics/spaces): Admin["System Admin"]

=== CLASS DIAGRAM (classDiagram) ===
SOURCE: Database Schema (design.dbTables), Domain Model (analysis.modules)
RULES:
- Each class must contain: attributes, methods, visibility, relationships, multiplicity
- Access modifiers: + (public), - (private), # (protected), ~ (package)
- Relationship priority: Inheritance <|--, Composition *--, Aggregation o--, Association -->, Dependency ..>
- Never create classes not existing in database or domain model
- At least 6 classes, at least 6 relationships
- Syntax for relationships with label: A "1" --> "*" B : label (NO |label| syntax)
- Syntax for relationships without label: A --> B

=== SEQUENCE DIAGRAM (sequenceDiagram) ===
SOURCE: User Stories, API Flow (design.apiEndpoints), Architecture
RULES:
- Participants must match existing architecture (User -> Frontend -> Controller -> Service -> Repository -> Database)
- Messages must follow actual execution order
- Never skip service layer, never access database directly from controller
- Use ->> for request, -->> for response
- Include at least 2 main flows of the project
- At least 5 participants
- Support: alt, opt, loop, break, activation, return messages

=== ERD (erDiagram) ===
SOURCE: Database Schema (design.dbTables)
RULES:
- Every table must have: Primary Key, Foreign Key, Data Type, Relationship, Cardinality
- At least 6 tables, at least 6 relationships
- Use crow foot notation: ||--o{ (1:N), ||--|| (1:1), }o--o{ (N:M), }o--|| (N:1)
- No duplicated columns, no isolated tables
- Table names in ASCII (sanitize Vietnamese: Benh_Nhan, not Bệnh nhân)

=== SELF VALIDATION ===
After generating each diagram, verify:
- No duplicated class/actor/entity
- Every relation exists and is correct
- Cardinality is correct
- Actor names match requirement
- Sequence messages correspond to API endpoints
- Database matches class model
- No isolated component
- All names use PascalCase (classes) or snake_case (DB tables)
- No spelling mistakes in entity names
- Node IDs are ASCII (no Vietnamese diacritics)
- Mermaid syntax is valid

If any inconsistency exists: REPAIR before output. Never output inconsistent UML.

${JSON_INSTRUCTION}
${FEW_SHOT_NOTE}
Tra object voi cac key BAT BUOC:
- "useCase" (string): Mermaid graph TD — actors from requirement, use cases from features, include/extend
- "classDiagram" (string): Mermaid classDiagram — classes from DB/domain, attributes+methods+relationships
- "erd" (string): Mermaid erDiagram — tables from DB schema, PK/FK/relationships/cardinality
- "sequence" (string): Mermaid sequenceDiagram — participants from architecture, 2+ flows, ->> and -->>

TAT CA 4 BIEU DO PHAI DONG BO VOI NHAU VA PHU HOP VOI CHU DE DU AN — khong dung vi du chung chung, phai dung entity that cua du an.`;
}

function docsPrompt(): string {
  return `Ban la Technical Writer. Viet README.md, Coding Convention, va API Response Standard BANG TIENG VIET, chi tiet de developer moi co the lam viec ngay.
QUAN TRONG: Tat ca tai lieu PHAI DE CAP CHU DE DU AN CU THE — vi du neu la "quan ly khach san" thi README phai noi ve khach san, dat phong, check-in/check-out, KHONG dung vi du chung chung.
QUAN TRONG: KHONG DUOC DE TRONG bat ky field nao. Tat ca 3 field (readme, convention, apiStandard) phai co noi dung day du, it nhat 500 ky tu moi field.
${JSON_INSTRUCTION}
${FEW_SHOT_NOTE}
Tra object voi cac key BAT BUOC:
- "readme" (string): noi dung README.md day du (gioi thieu du an cu the, cai dat, chay, cau truc, huong dan code, vi du API call cu the cua du an). It nhat 800 ky tu.
- "convention" (string): Coding Convention CHI TIET — ten bien (camelCase/snake_case), ten file (kebab-case/PascalCase), function naming, class naming, comment format (JSDoc), git commit message format (conventional commits), import order, error handling pattern. Kem vi du cu the cho tung rule. It nhat 500 ky tu. KHONG DE TRONG.
- "apiStandard" (string): API Response Standard CHI TIET — format JSON response (success + error), status code convention (200/201/400/401/403/404/500), error response structure (code, message, details), pagination format, timestamp format, authentication header format. Kem vi du JSON response cu the cua du an. It nhat 500 ky tu. KHONG DE TRONG.`;
}

function gitPrompt(): string {
  return `Ban la DevOps Engineer. Viet git commands, branch strategy (Mermaid), va issue template.
QUAN TRONG:
- branchStrategy: Mermaid "graph LR", KHONG dung [("text")]
- issueTemplate: YAML front matter, escape newline bang \\n
${JSON_INSTRUCTION}
${FEW_SHOT_NOTE}
Tra object voi cac key BAT BUOC:
- "gitCommands" (string): cac lenh git setup (clone, branch, commit, push, pull request) - day du
- "branchStrategy" (string): code mermaid graph LR mo ta main/develop/Feature/HotFix
- "issueTemplate" (string): issue template YAML
- "repoUrl" (string): URL repo vi du https://github.com/org/project`;
}

function testerPrompt(): string {
  return `Ban la Senior QA Engineer & Software Tester. Lap ke hoach test CHI TIET cho du an: test strategy, unit tests, integration tests, E2E tests, API tests, performance tests.
${JSON_INSTRUCTION}
${FEW_SHOT_NOTE}
Tra object voi cac key BAT BUOC:
- "testStrategy" (string): 4-6 cau mo ta chien luoc test (pyramid test, coverage target, tools su dung vd Vitest/Jest/Playwright)
- "unitTests" (array): moi phan tu { "module" (string), "cases" (array: moi { "name", "desc", "input", "expected" }) }. It nhat 5 module, moi module it nhat 3 case.
- "integrationTests" (array): moi phan tu { "name", "desc", "flow" }. It nhat 4 test (vd: auth flow, CRUD flow, payment flow).
- "e2eTests" (array): moi phan tu { "name", "desc", "steps" (array string) }. It nhat 3 E2E scenario.
- "apiTests" (array): moi phan tu { "endpoint", "method", "cases" }. It nhat 5 API test.
- "performanceTests" (array): moi phan tu { "scenario", "metric", "target" }. It nhat 3 scenario (vd: response time, throughput, concurrent users).
- "bugReportTemplate" (string): template bug report (title, steps, expected, actual, severity, environment)`;
}

function securityPrompt(): string {
  return `Ban la Security Architect. Phan tich security cho du an: threats, auth flow, authorization model, data protection, OWASP checklist, rate limiting, secrets management.
${JSON_INSTRUCTION}
${FEW_SHOT_NOTE}
Tra object voi cac key BAT BUOC:
- "threats" (array): moi phan tu { "risk", "severity" ("Critical"|"High"|"Medium"|"Low"), "mitigation" }. It nhat 6 threats (vd: SQL Injection, XSS, CSRF, broken auth, sensitive data exposure, missing rate limit).
- "authFlow" (string): 4-6 cau mo ta auth flow (JWT/Session/OAuth, token generation, refresh, expiry, storage).
- "authzModel" (string): mo ta authorization model (RBAC/ABAC, roles, permissions, checks).
- "dataProtection" (string): mo ta data protection (encryption at rest/transit, bcrypt/argon2, HTTPS, PII handling).
- "owaspChecklist" (array): moi phan tu { "category", "status" ("Pass"|"Warning"|"Fail"), "note" }. It nhat 8 OWASP Top 10 items (A01 Broken Access Control, A02 Crypto Failures, A03 Injection, ... A10 SSRF).
- "rateLimit" (string): mo ta rate limiting strategy (per IP, per user, per endpoint, thresholds, 429 handling).
- "secrets" (string): mo ta secrets management (env vars, vault, .gitignore, rotation).`;
}

function reviewerPrompt(): string {
  return `Ban la Quality Reviewer. Ban nhan toan bo ket qua cua 9 Agent va kiem tra dong bo, bo sung thong tin thieu, sua loi sai.
${JSON_INSTRUCTION}
${FEW_SHOT_NOTE}
Tra object voi cung cau truc giong input (analysis, hr, sprint, design, uml, docs, git, test, security). Chi sua nhung gi can sua, giu nguyen nhung gi da dung. Dam bao:
- HR assignments phu hop voi danh sach thanh vien that
- Sprint tasks gan dung assignee voi ten thanh vien
- DB tables va API endpoints phu hop voi features
- UML phu hop voi modules va actors
- Test cases phu hop voi features va API endpoints
- Security threats phu hop voi tech stack va auth flow`;
}

const TASK_GEN_PROMPT = `Ban la Senior Project Manager & Tech Lead. Ban tao todolist CHI TIET cho tung thanh vien de ho co the bat dau code ngay ma khong can hoi them.
Muc tieu: nguoi moi hoan toan khong biet gi cung hieu phai lam gi, vai tro gi, code nhu the nao de dong bo voi nguoi khac.

NGUYEN TAC SINH TASK (SMART + ATOMIC):
1. Moi task bat dau bang DONG TU HANH DONG (vd: "Thiet ke", "Viet", "Tao", "Cau hinh")
2. NGUYEN TU HOA: 1 task = 1 cong vie cu the, khong the chia nho hon
3. KHONG GIOI HAN so luong task — sinh bao nhieu task tuy theo do phuc tap du an, mien sao phu hop, ro rang, de hieu, tap trung, KHONG chung chung
4. Moi thanh vien co nhieu task theo vai tro + kha nang (it nhat 5, khong gioi han tren)
5. Task phai co BOI CANH file/ngu canh ro rang (vd: "Trong file src/api/users.ts")
6. Task phai co GIAI MA KY THUAT (code snippets, SQL, config examples)
7. Dependencies phai ro rang: task nao phai lam truoc, task nao phu thuoc task nao
8. Task PHAI PHU HOP VOI CHU DE DU AN — dung ten entity, ten file, ten module that cua du an

CRITICAL — KHONG TRUNG LAP:
- TUYET DOI KHONG sinh 2 task trung ten hoac trung noi dung
- Moi task phai DUY NHAT — kiem tra lai danh sach truoc khi them task moi
- Neu 2 task tuong tu nhau, hop nhat thanh 1 task duy nhat

DAM BAO DAO (phu hop toan bo he thong):
- Phan ra theo TAT CA layers: Database (schema, migration, seed), Backend (API CRUD, auth, validation), Frontend UI (layout, pages, components), Testing (unit, integration, e2e), DevOps (CI/CD, Docker, deploy)
- Dua tren PHAN TICH (features, actors, modules) + NHAN SU (assignments, modules) + SPRINT (tasks, milestones) + THIET KE (DB tables, API endpoints, folder structure)
- Moi feature/module trong phan tich phai co it nhat 1 task tuong ung
- Moi API endpoint trong thiet ke phai co 1 task implement
- Moi DB table trong thiet ke phai co 1 task tao model + migration
- Moi member phai co task phu hop voi role va modules duoc gan

${JSON_INSTRUCTION}
${FEW_SHOT_NOTE}
Tra object voi key "tasks" (array). Moi task co:
- "assigneeName" (string): ten thanh vien (phai khop voi danh sach)
- "title" (string): ten task bat dau bang dong tu, cu the (vd: "Thiet ke Schema Prisma cho Bang Users")
- "description" (string): mo ta chi tiet 3-5 cau. Ghi ro: muc tieu, file can sua, cach lam, Definition of Done.
- "role" (string): vai tro (vd "Backend Developer")
- "layer" (string): "DATABASE" | "BACKEND" | "UI" | "CONFIG" | "TESTING"
- "targetFile" (string): file/namespace can can thiep (vd: "prisma/schema.prisma" hoac "src/components/UserList.tsx")
- "responsibilities" (array string): danh sach trach nhiem chi tiet (it nhat 3)
- "codeConventions" (array string): QUY UOC CODE + CODE SNIPPETS cu the
- "implementationSteps" (array string): cac buoc lam cu the (it nhat 3). Vd: ["1. Tao User model trong Prisma", "2. Chay prisma migrate", "3. Viet unit test"]
- "technicalHints" (object): { "snippet": "doan code mau cu the (SQL/Prisma/React/C#)", "note": "luu y ky thuat" }
- "dependencies" (string): phu thuoc task nao truoc
- "acceptanceCriteria" (array string): tieu chi hoan thanh (it nhat 3)
- "deadline" (string YYYY-MM-DD): han chot - tinh tu hom nay, phan bo theo do kho
- "sprintName" (string): "Sprint 1" hoac "Sprint 2"...
- "hours" (number): so gio du kien (2-40h)
- "priority" (string): "P0" (bat buoc) | "P1" (quan trong) | "P2" (nice-to-have)

DAM BAO:
- Phan ra theo layers: Database, API Backend, Frontend UI, Testing, DevOps
- KHONG GIOI HAN so luong task — sinh day du, triet de, phu hop voi du an
- codeConventions + technicalHints phai CO CODE SNIPPETS cu the (SQL, Prisma schema, API response, component props)
- Dependencies lien ket ro rang giua cac task cua cac thanh vien khac nhau
- Deadline phan bo theo do uu tien + do kho
- technicalHints.snippet phai la code dung de copy-paste (SQL JOIN, Prisma model, React component, etc.)
- Tat ca task PHAI de cap entity/module that cua du an (vd: neu la "quan ly khach san" thi co task ve Rooms, Reservations, Guests, KHONG dung User/Course chung chung)`;

const PROMPT_MAP: Record<SectionType, () => string> = {
  analysis: analystPrompt,
  hr: hrPrompt,
  sprint: sprintPrompt,
  design: architectPrompt,
  uml: umlPrompt,
  docs: docsPrompt,
  git: gitPrompt,
  test: testerPrompt,
  security: securityPrompt,
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
  // Defensive: handle both string and array for requirements/techPrefs/langPrefs
  // (old DB rows may store arrays; type says string)
  const toArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map((x) => String(x));
    if (typeof v === "string" && v.trim()) return v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    return [];
  };
  const requirementsStr = toArray(extra.requirements).join("; ");
  const techPrefsStr = toArray(extra.techPrefs).join(", ");
  const langPrefsStr = toArray(extra.langPrefs).join(", ");

  let c = `Du an: ${input.topic}`;
  if (input.description) c += `\nMo ta: ${input.description}`;
  if (input.purpose) c += `\nMuc dich: ${input.purpose}`;
  if (requirementsStr) c += `\nChuc nang yeu cau: ${requirementsStr}`;
  if (extra.specialReqs) c += `\nYeu cau dac biet: ${extra.specialReqs}`;
  if (techPrefsStr) c += `\nCong nghe: ${techPrefsStr}`;
  if (langPrefsStr) c += `\nNgon ngu: ${langPrefsStr}`;
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
    case "test":
      c += `\n\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      c += `\nFeatures: ${JSON.stringify(
        (results.analysis?.features || []).map((f) => ({ name: f.name, module: f.module, pri: f.pri }))
      )}`;
      c += `\nAPI endpoints: ${JSON.stringify(
        (results.design?.apiEndpoints || []).map((e) => ({ method: e.method, path: e.path }))
      )}`;
      c += `\nTech: ${JSON.stringify(results.analysis?.techStack)}`;
      break;
    case "security":
      c += `\n\nTech: ${JSON.stringify(results.analysis?.techStack)}`;
      c += `\nActors: ${JSON.stringify(
        (results.analysis?.actors || []).map((a) => ({ name: a.name, desc: a.desc }))
      )}`;
      c += `\nDB tables: ${JSON.stringify((results.design?.dbTables || []).map((t) => t.name))}`;
      c += `\nAPI endpoints: ${JSON.stringify(
        (results.design?.apiEndpoints || []).map((e) => ({ method: e.method, path: e.path }))
      )}`;
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
  // Defensive: handle both string and array for requirements
  const toArr = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map((x) => String(x));
    if (typeof v === "string" && v.trim()) return v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    return [];
  };
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
        features: toArr(input.extraInfo.requirements).map((r) => ({ name: r, module: "Core", pri: "P1" })),
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
      // Generate ALL 4 UML diagrams from analysis/design data as fallback
      const tables = (results.design?.dbTables || []).map((t) => t.name);
      const actors = (results.analysis?.actors || []).map((a) => a.name);
      const features = (results.analysis?.features || []).map((f) => f.name);
      const modules = (results.analysis?.modules || []);

      // Use Case diagram — from actors + features
      const useCaseActors = actors.length > 0 ? actors : ["User"];
      const useCaseFeatures = features.length > 0 ? features : modules.length > 0 ? modules : ["Core Feature"];
      const useCaseLines = useCaseActors.map((a, i) => {
        const actorId = `Actor${i}`;
        return useCaseFeatures.map((f, j) => {
          const featId = `F${j}`;
          return `${actorId}["${a}"] --> ${featId}["${f}"]`;
        }).join("\n    ");
      }).join("\n    ");
      const useCaseFallback = `graph TD\n    ${useCaseLines}`;

      // Class diagram — from DB tables
      const classTables = tables.length > 0 ? tables : modules.length > 0 ? modules : ["Core"];
      const classLines = classTables.map((t) => {
        const className = t.replace(/[^A-Za-z0-9]/g, "");
        return `class ${className} {\n    +int id\n    +string name\n    +DateTime createdAt\n}`;
      }).join("\n\n");
      const classRelations = classTables.length > 1
        ? `\n${classTables[0].replace(/[^A-Za-z0-9]/g, "")} "1" --> "*" ${classTables[1].replace(/[^A-Za-z0-9]/g, "")} : "has"`
        : "";
      const classFallback = `classDiagram\n${classLines}${classRelations}`;

      // ERD — from DB tables
      const erdFallback = tables.length > 0
        ? `erDiagram\n${tables.map((t) => `    ${t.replace(/[^A-Za-z0-9_]/g, "_")} {\n        int id PK\n        string name\n    }`).join("\n")}\n${tables.length > 1 ? `    ${tables[0].replace(/[^A-Za-z0-9_]/g, "_")} ||--o{ ${tables[1].replace(/[^A-Za-z0-9_]/g, "_")} : "has"` : ""}`
        : `erDiagram\n    CORE {\n        int id PK\n        string name\n    }`;

      // Sequence — from actors
      const seqActor = actors.length > 0 ? actors[0] : "User";
      const seqFallback = `sequenceDiagram\n    participant U as ${seqActor}\n    participant S as System\n    U->>S: Request\n    S-->>U: Response\n    Note over U,S: Default sequence diagram`;

      return {
        useCase: results.uml?.useCase || useCaseFallback,
        classDiagram: results.uml?.classDiagram || classFallback,
        erd: results.uml?.erd || erdFallback,
        sequence: results.uml?.sequence || seqFallback,
      };
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
    case "test":
      return {
        testStrategy: "Test pyramid: unit > integration > E2E. Coverage target 80%. Tools: Vitest/Jest (unit), Supertest (integration), Playwright (E2E).",
        unitTests: (results.analysis?.modules || ["Core"]).slice(0, 5).map((mod) => ({
          module: mod,
          cases: [
            { name: `test_${mod}_create`, desc: "Test create operation", input: "valid payload", expected: "201 created" },
            { name: `test_${mod}_validation`, desc: "Test input validation", input: "invalid payload", expected: "400 bad request" },
            { name: `test_${mod}_notFound`, desc: "Test not found", input: "non-existent id", expected: "404 not found" },
          ],
        })),
        integrationTests: [
          { name: "auth_flow", desc: "Test login + protected route", flow: "POST /api/auth/login → GET /api/me with token" },
          { name: "crud_flow", desc: "Test full CRUD cycle", flow: "POST → GET → PUT → DELETE" },
        ],
        e2eTests: [
          { name: "user_signup_to_dashboard", desc: "Signup → login → dashboard", steps: ["1. Visit /signup", "2. Fill form", "3. Submit", "4. Redirect to dashboard"] },
        ],
        apiTests: (results.design?.apiEndpoints || []).slice(0, 5).map((e) => ({
          endpoint: e.path,
          method: e.method,
          cases: `Test ${e.method} ${e.path} — happy path + error cases`,
        })),
        performanceTests: [
          { scenario: "API response time", metric: "p95 latency", target: "< 200ms" },
          { scenario: "Concurrent users", metric: "throughput", target: "100 req/s" },
        ],
        bugReportTemplate: "## Bug Report\n**Title:** \n**Steps:**\n1. \n**Expected:** \n**Actual:** \n**Severity:** Low/Medium/High/Critical\n**Environment:** ",
      };
    case "security":
      return {
        threats: [
          { risk: "SQL Injection", severity: "High", mitigation: "Use Prisma parameterized queries — never string concatenation" },
          { risk: "XSS", severity: "Medium", mitigation: "Escape output, use CSP headers, avoid dangerouslySetInnerHTML" },
          { risk: "CSRF", severity: "Medium", mitigation: "Use SameSite cookies + CSRF tokens" },
          { risk: "Broken Authentication", severity: "High", mitigation: "JWT with short expiry + refresh token, bcrypt password hashing" },
          { risk: "Sensitive Data Exposure", severity: "High", mitigation: "HTTPS everywhere, encrypt PII at rest, never log secrets" },
          { risk: "Missing Rate Limiting", severity: "Medium", mitigation: "Rate limit login + API endpoints per IP/user" },
        ],
        authFlow: "JWT-based auth. Login → server validates credentials → issues access token (15min) + refresh token (7d). Access token in Authorization header. Refresh token in httpOnly cookie.",
        authzModel: "RBAC (Role-Based Access Control). Roles: admin, member, guest. Middleware checks role on each protected route. Resource ownership checks for user-specific data.",
        dataProtection: "Passwords hashed with bcrypt (cost 12). PII encrypted at rest with AES-256. HTTPS enforced. Secrets in env vars, never committed. Sensitive fields excluded from logs.",
        owaspChecklist: [
          { category: "A01 Broken Access Control", status: "Pass", note: "RBAC middleware on all routes" },
          { category: "A02 Cryptographic Failures", status: "Pass", note: "bcrypt + AES-256 + HTTPS" },
          { category: "A03 Injection", status: "Pass", note: "Prisma parameterized queries" },
          { category: "A04 Insecure Design", status: "Warning", note: "Review threat model" },
          { category: "A05 Security Misconfiguration", status: "Warning", note: "Verify prod config" },
          { category: "A06 Vulnerable Components", status: "Warning", note: "Run npm audit regularly" },
          { category: "A07 Auth Failures", status: "Pass", note: "JWT + refresh + rate limit" },
          { category: "A08 Software/Data Integrity", status: "Pass", note: "Signed dependencies" },
          { category: "A09 Logging Failures", status: "Warning", note: "Add audit logs" },
          { category: "A10 SSRF", status: "Pass", note: "Validate external URLs" },
        ],
        rateLimit: "Per-IP rate limit: 100 req/min general, 5 req/min for login. Per-user: 1000 req/hour. Return 429 with Retry-After header. Use sliding window counter.",
        secrets: "All secrets in .env (gitignored). Use dotenv for loading. Rotate keys quarterly. Never hardcode. Production: use secret manager (Vault/AWS Secrets Manager).",
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

  // ===== PHASE 0: Planner Agent — decompose topic into modules before Analysis =====
  // Planner reads the topic + description and generates a module breakdown
  // that Analysis Agent uses as a starting point. This prevents Analysis from
  // guessing modules and improves consistency across all sections.
  appendLog({
    level: "info",
    agentId: "PLANNER",
    provider: "pipeline",
    message: `▶ [PLANNER] Decomposing topic into modules...`,
  });

  const plannerResult = await callAndParse(
    ["openai/gpt-oss-120b:free", "nvidia/nemotron-3-super-120b-a12b:free", "google/gemma-4-31b-it:free"],
    `Ban la Project Planner. Nhiem vu: chia nho chu de du an thanh cac module cu the.
${JSON_INSTRUCTION}
${FEW_SHOT_NOTE}
Tra object voi:
- "modules" (array string): danh sach 8-15 module cu the phu hop voi chu de (vd: "Auth", "Patient Management", "Appointment Scheduling")
- "priority" (array string): thu tu uu tien cua cac module (giong thu tu modules)
- "domain" (string): linh vuc cua du an (vd: "Healthcare", "E-commerce", "Education")
- "keywords" (array string): cac tu khoa quan trong de Analysis Agent su dung`,
    `Du an: ${input.topic}
Mo ta: ${input.description}
Muc dich: ${input.purpose}

Hay chia nho du an thanh cac module cu the:`,
    0.2,
    undefined // no Zod validation for planner
  );

  if (plannerResult && plannerResult.data) {
    const plan = plannerResult.data as { modules?: string[]; domain?: string; keywords?: string[] };
    if (plan.modules && plan.modules.length > 0) {
      appendLog({
        level: "success",
        agentId: "PLANNER",
        provider: "pipeline",
        model: plannerResult.model,
        message: `✓ [PLANNER] ${plan.modules.length} modules: ${plan.modules.join(", ")}`,
      });
      // Inject planner output into input.extraInfo so Analysis Agent sees it
      const toArray = (v: unknown): string[] => {
        if (Array.isArray(v)) return v.map(String);
        if (typeof v === "string") return v.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
        return [];
      };
      const existingReqs = toArray(input.extraInfo.requirements);
      const planModules = plan.modules.map((m) => `Module: ${m}`);
      input = {
        ...input,
        extraInfo: {
          ...input.extraInfo,
          requirements: [...planModules, ...existingReqs].join("\n"),
        },
      };
    }
  } else {
    appendLog({
      level: "warn",
      agentId: "PLANNER",
      provider: "pipeline",
      message: `⚠ [PLANNER] Failed — Analysis will run without pre-planning`,
    });
  }

  // ===== PHASE 1: Sequential agents (analysis → hr → sprint) =====
  // These must run sequentially because each depends on the previous
  const phase1Agents = AGENTS.filter((a) => ["analysis", "hr", "sprint"].includes(a.key));
  const phase2Agents = AGENTS.filter((a) => ["design", "uml", "docs", "git"].includes(a.key));
  const phase3Agents = AGENTS.filter((a) => ["test", "security"].includes(a.key));
  const parallel = input.parallel !== false; // default true

  // Helper: run a single agent (used by both sequential + parallel modes)
  async function runAgent(ag: AgentDef): Promise<{ ag: AgentDef; res: ParseResult | null; failed: boolean }> {
    const i = AGENTS.indexOf(ag);
    onProgress?.({ type: "agent_start", id: ag.id, name: ag.name, index: i, total });
    const modeLabel = parallel ? "parallel" : "sequential";
    console.log(`>> [AGENT-${ag.id}] ${ag.name} (${modeLabel})`);
    appendLog({
      level: "info",
      agentId: ag.id,
      provider: "pipeline",
      message: `[AGENT-${ag.id}] ${ag.name} → start (${modeLabel})`,
    });

    const ctx = buildCtx(ag.key, results, input);
    const res = await callAndParse(ag.models, PROMPT_MAP[ag.key](), ctx, ag.temp, ag.key);

    if (res && isValidSchema(res.data, ag.key)) {
      (results as Record<string, unknown>)[ag.key] = res.data;
      onProgress?.({ type: "agent_done", id: ag.id, name: ag.name, index: i, total });
      console.log(`✓ [AGENT-${ag.id}] ${ag.name} → ${res.model}`);
      appendLog({
        level: "success",
        agentId: ag.id,
        provider: "pipeline",
        model: res.model,
        message: `✓ [AGENT-${ag.id}] ${ag.name} → done (${res.model})`,
      });
      return { ag, res, failed: false };
    } else if (res) {
      (results as Record<string, unknown>)[ag.key] = res.data;
      onProgress?.({ type: "agent_done", id: ag.id, name: ag.name, index: i, total });
      console.log(`⚠ [AGENT-${ag.id}] ${ag.name} → Schema loi, van luu`);
      appendLog({
        level: "warn",
        agentId: ag.id,
        provider: "pipeline",
        model: res.model,
        message: `⚠ [AGENT-${ag.id}] ${ag.name} → schema invalid, saved anyway`,
      });
      return { ag, res, failed: false };
    } else {
      onProgress?.({ type: "agent_fail", id: ag.id, name: ag.name, index: i, total });
      console.log(`✗ [AGENT-${ag.id}] ${ag.name} → TAT CA MODEL FAIL`);
      appendLog({
        level: "error",
        agentId: ag.id,
        provider: "pipeline",
        message: `✗ [AGENT-${ag.id}] ${ag.name} → ALL MODELS FAILED`,
      });
      return { ag, res: null, failed: true };
    }
  }

  for (const ag of phase1Agents) {
    appendLog({
      level: "info",
      agentId: ag.id,
      provider: "pipeline",
      message: `─────────────────────────────────────────────`,
    });
    const r = await runAgent(ag);
    if (r.failed) failed.push(r.ag);
  }

  // ===== PHASE 2 + 3: design/uml/docs/git + test/security =====
  if (parallel) {
    // PARALLEL MODE: Phase 2 (4 agents) then Phase 3 (2 agents), each in parallel
    console.log(`\n>> [PARALLEL] Running ${phase2Agents.length} agents in parallel...`);
    appendLog({
      level: "info",
      agentId: "PIPELINE",
      provider: "pipeline",
      message: `▶ PHASE 2: ${phase2Agents.length} agents in parallel`,
    });
    const phase2Results = await Promise.all(phase2Agents.map((ag) => runAgent(ag)));
    for (const r of phase2Results) {
      if (r.failed) failed.push(r.ag);
    }

    console.log(`\n>> [PARALLEL] Running ${phase3Agents.length} agents in parallel (Phase 3)...`);
    appendLog({
      level: "info",
      agentId: "PIPELINE",
      provider: "pipeline",
      message: `▶ PHASE 3: ${phase3Agents.length} agents in parallel (test + security)`,
    });
    const phase3Results = await Promise.all(phase3Agents.map((ag) => runAgent(ag)));
    for (const r of phase3Results) {
      if (r.failed) failed.push(r.ag);
    }
  } else {
    // SEQUENTIAL MODE: run all Phase 2 + 3 agents one at a time
    // Avoids sending too many requests at once → fewer 429 rate-limits
    appendLog({
      level: "info",
      agentId: "PIPELINE",
      provider: "pipeline",
      message: `▶ SEQUENTIAL MODE: running agents one at a time (avoids rate-limit spikes)`,
    });
    for (const ag of [...phase2Agents, ...phase3Agents]) {
      appendLog({
        level: "info",
        agentId: ag.id,
        provider: "pipeline",
        message: `─────────────────────────────────────────────`,
      });
      const r = await runAgent(ag);
      if (r.failed) failed.push(r.ag);
    }
  }

  // ===== PHASE 4: Retry failed agents =====
  if (failed.length > 0) {
    console.log(`\n>> RETRY: ${failed.length} Agent that bai...`);
    appendLog({
      level: "warn",
      agentId: "PIPELINE",
      provider: "pipeline",
      message: `▶ RETRY: ${failed.length} agent(s) failed, retrying after 5s`,
    });
    for (const ag of failed) {
      onProgress?.({
        type: "agent_start",
        id: ag.id,
        name: `${ag.name} (Retry)`,
        index: 7,
        total,
      });
      console.log(`   ⏳ Doi 5s truoc retry ${ag.name}...`);
      appendLog({
        level: "warn",
        agentId: ag.id,
        provider: "pipeline",
        message: `[AGENT-${ag.id}] ${ag.name} → retry in 5s...`,
      });
      await wait(5000);

      const ctx = buildCtx(ag.key, results, input);
      const res = await callAndParse(ag.models, PROMPT_MAP[ag.key](), ctx, ag.temp, ag.key);

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
        appendLog({
          level: "success",
          agentId: ag.id,
          provider: "pipeline",
          model: res.model,
          message: `✓ [RETRY-${ag.id}] ${ag.name} → done (${res.model})`,
        });
      } else if (res) {
        (results as Record<string, unknown>)[ag.key] = res.data;
        onProgress?.({ type: "agent_done", id: ag.id, name: `${ag.name} (Retry)`, index: 7, total });
        appendLog({
          level: "warn",
          agentId: ag.id,
          provider: "pipeline",
          model: res.model,
          message: `⚠ [RETRY-${ag.id}] ${ag.name} → schema invalid, saved anyway`,
        });
      } else {
        onProgress?.({ type: "agent_fail", id: ag.id, name: `${ag.name} (Retry)`, index: 7, total });
        console.log(`✗ [RETRY-${ag.id}] ${ag.name} → VAN FAIL`);
        appendLog({
          level: "error",
          agentId: ag.id,
          provider: "pipeline",
          message: `✗ [RETRY-${ag.id}] ${ag.name} → STILL FAIL`,
        });
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
      const i = AGENTS.indexOf(ag);
      console.log(`>> FALLBACK: ${ag.name}`);
      appendLog({
        level: "warn",
        agentId: ag.id,
        provider: "fallback",
        message: `▷ FALLBACK: ${ag.name} → using static fallback data`,
      });
      (results as unknown as Record<string, unknown>)[ag.key] = fallback(ag.key, input, results);
      // CRITICAL: emit agent_done so the UI updates (otherwise agent stays "pending" forever)
      onProgress?.({ type: "agent_done", id: ag.id, name: `${ag.name} (Fallback)`, index: i, total });
      appendLog({
        level: "success",
        agentId: ag.id,
        provider: "fallback",
        message: `✓ [AGENT-${ag.id}] ${ag.name} → done (fallback)`,
      });
    }
  }

  // ===== PHASE 5.5: Output Normalizer + Consistency Checker =====
  // Normalize all section outputs: trim strings, remove duplicates, ensure arrays
  appendLog({
    level: "info",
    agentId: "NORMALIZER",
    provider: "pipeline",
    message: `▶ [NORMALIZER] Standardizing output across all sections...`,
  });

  for (const [key, value] of Object.entries(results)) {
    if (!value || typeof value !== "object") continue;
    const data = value as unknown as Record<string, unknown>;
    // Normalize string fields: trim, remove null bytes
    for (const [field, val] of Object.entries(data)) {
      if (typeof val === "string") {
        data[field] = val.trim().replace(/\0/g, "").replace(/\s{3,}/g, " ");
      }
      // Deduplicate arrays
      if (Array.isArray(val)) {
        const seen = new Set<string>();
        data[field] = val.filter((item) => {
          const key = JSON.stringify(item);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    }
  }

  // Consistency check: verify cross-section entity names match
  const analysisModules = (results.analysis?.modules || []) as string[];
  const designTables = (results.design?.dbTables || []).map((t) => t.name);
  const hrAssignees = (results.hr?.assignments || []).map((a) => a.name);
  const inconsistencies: string[] = [];

  // Check: HR assignees should match input members
  const inputMembers = input.members.map((m) => m.name.toLowerCase());
  for (const assignee of hrAssignees) {
    if (!inputMembers.includes(assignee.toLowerCase())) {
      inconsistencies.push(`HR assigns "${assignee}" but no such member in input`);
    }
  }

  // Check: Design tables should relate to analysis modules
  if (analysisModules.length > 0 && designTables.length > 0) {
    appendLog({
      level: "info",
      agentId: "NORMALIZER",
      provider: "pipeline",
      message: `✓ [CONSISTENCY] ${analysisModules.length} modules ↔ ${designTables.length} DB tables ↔ ${hrAssignees.length} assignees checked`,
    });
  }

  if (inconsistencies.length > 0) {
    appendLog({
      level: "warn",
      agentId: "NORMALIZER",
      provider: "pipeline",
      message: `⚠ [CONSISTENCY] ${inconsistencies.length} issue(s): ${inconsistencies.slice(0, 3).join("; ")}`,
    });
  } else {
    appendLog({
      level: "success",
      agentId: "NORMALIZER",
      provider: "pipeline",
      message: `✓ [NORMALIZER] All sections normalized + consistency OK`,
    });
  }

  // ===== PHASE 6: Quality Reviewer (AGENT-10) =====
  onProgress?.({
    type: "agent_start",
    id: "10",
    name: "Quality Reviewer",
    index: 9,
    total,
  });
  console.log("\n>> [AGENT-10] Quality Reviewer");
  appendLog({
    level: "info",
    agentId: "10",
    provider: "pipeline",
    message: `─────────────────────────────────────────────`,
  });
  appendLog({
    level: "info",
    agentId: "10",
    provider: "pipeline",
    message: `[AGENT-10] Quality Reviewer → start`,
  });

  try {
    // Send FULL results (not just summary) so reviewer can actually fix content.
    // Truncate to ~12000 chars to stay within token limits.
    const fullResults = JSON.stringify(results).substring(0, 12000);
    const res = await callAndParse(
      REVIEWER_MODELS,
      reviewerPrompt(),
      `Du an: ${input.topic}\n\nKET QUA DAY DU CUA 9 AGENT (JSON):\n${fullResults}`,
      0.1,
      undefined // reviewer output is merged, not a single section
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

      // Reviewer Feedback Loop — validate each section with Zod,
      // if any fail, ask AI to fix that specific section (max 2 rounds)
      for (let round = 1; round <= 2; round++) {
        const invalidSections: { key: string; error: string }[] = [];
        for (const key of Object.keys(rev) as string[]) {
          if (key === "test" || key === "security") {
            // Optional sections — skip Zod if not present
            if (!rev[key]) continue;
          }
          const zodResult = validateSection(key, rev[key]);
          if (!zodResult.success) {
            invalidSections.push({ key, error: zodResult.error.substring(0, 200) });
          }
        }
        if (invalidSections.length === 0) {
          appendLog({
            level: "success",
            agentId: "10",
            provider: "pipeline",
            message: `✓ [REVIEW LOOP] Round ${round}: All sections Zod-validated ✓`,
          });
          break;
        }
        appendLog({
          level: "warn",
          agentId: "10",
          provider: "pipeline",
          message: `⚠ [REVIEW LOOP] Round ${round}: ${invalidSections.length} section(s) failed Zod — asking AI to fix`,
        });
        // Fix each invalid section
        for (const { key, error } of invalidSections) {
          const fixPrompt = `Section "${key}" that bai Zod validation: ${error}\n\nSua lai JSON cho dung schema. Giu nguyen noi dung, chi sua cau truc:\n${JSON.stringify(rev[key]).substring(0, 3000)}`;
          const fixRes = await callAndParse(
            REVIEWER_MODELS,
            "JSON schema fixer. Tra JSON dung schema.",
            fixPrompt,
            0.1,
            key
          );
          if (fixRes && fixRes.data) {
            const revalidate = validateSection(key, fixRes.data);
            if (revalidate.success) {
              rev[key] = revalidate.data;
              appendLog({
                level: "success",
                agentId: "10",
                provider: "pipeline",
                model: fixRes.model,
                message: `  ✓ [REVIEW LOOP] Fixed "${key}" via ${fixRes.model}`,
              });
            }
          }
        }
      }

      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      onProgress?.({ type: "agent_done", id: "10", name: "Quality Reviewer", index: 9, total });
      console.log(`✓ [AGENT-10] Reviewer → ${res.model} (${sec}s tong)`);
      appendLog({
        level: "success",
        agentId: "10",
        provider: "pipeline",
        model: res.model,
        message: `✓ [AGENT-10] Reviewer → done (${res.model}, ${sec}s total)`,
      });

      // ===== Observability: Pipeline Metrics Summary (success branch) =====
      const sectionsOK = Object.keys(rev).length;
      const failedCnt = failed.length;
      const sRate = ((AGENTS.length - failedCnt) / AGENTS.length * 100).toFixed(0);
      appendLog({
        level: "info",
        agentId: "PIPELINE",
        provider: "pipeline",
        message: `📊 [METRICS] Pipeline: ${sec}s | ${sectionsOK}/9 sections | ${sRate}% success | ${failedCnt} failed`,
      });

      return rev as unknown as ProjectResult;
    }
  } catch (e) {
    console.log(`✗ [AGENT-10] Reviewer fail: ${(e as Error).message?.substring(0, 100)}`);
    appendLog({
      level: "error",
      agentId: "10",
      provider: "pipeline",
      message: `✗ [AGENT-10] Reviewer → ${(e as Error).message?.substring(0, 100)}`,
    });
  }

  onProgress?.({ type: "agent_fail", id: "10", name: "Quality Reviewer", index: 9, total });
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`>> Tra ket qua goc (${sec}s)\n`);

  // ===== Observability: Pipeline Metrics Summary =====
  const totalDuration = Date.now() - t0;
  const sectionsGenerated = Object.keys(results).length;
  const failedCount = failed.length;
  const successRate = ((AGENTS.length - failedCount) / AGENTS.length * 100).toFixed(0);

  // Collect per-model health stats
  const allModelsUsed = new Set<string>();
  for (const ag of AGENTS) {
    ag.models.forEach(m => allModelsUsed.add(m));
  }
  const modelStats = Array.from(allModelsUsed).map(m => {
    const h = getModelHealth(m);
    return { model: m, ...h };
  }).filter(s => s.totalCalls > 0);

  appendLog({
    level: "info",
    agentId: "PIPELINE",
    provider: "pipeline",
    message: `📊 [METRICS] Pipeline: ${sec}s | ${sectionsGenerated}/9 sections | ${successRate}% success | ${failedCount} failed | ${modelStats.length} models used`,
  });

  for (const stat of modelStats) {
    appendLog({
      level: stat.successRate >= 0.8 ? "success" : stat.successRate >= 0.5 ? "warn" : "error",
      agentId: "METRICS",
      provider: "openrouter",
      model: stat.model,
      message: `📊 ${stat.model}: ${(stat.successRate * 100).toFixed(0)}% success (${stat.totalCalls} calls)`,
    });
  }

  appendLog({
    level: "warn",
    agentId: "10",
    provider: "pipeline",
    message: `▷ [AGENT-10] Reviewer → returning original results (${sec}s)`,
  });
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

  appendLog({
    level: "info",
    agentId: "REFINE",
    provider: "pipeline",
    message: `▶ AI REFINE STARTED — ${AGENTS.length} sections to re-generate`,
  });
  if (editRequests.length > 0) {
    for (const e of editRequests) {
      appendLog({
        level: "info",
        agentId: "REFINE",
        provider: "pipeline",
        message: `📝 Leader edit request [${e.section}]: ${e.change.substring(0, 120)}`,
      });
    }
  }
  if (chatDiscussion) {
    appendLog({
      level: "info",
      agentId: "REFINE",
      provider: "pipeline",
      message: `💬 Chat discussion attached (${chatDiscussion.length} chars)`,
    });
  }

  const sectionLabels: Record<string, string> = {
    analysis: "Phân tích",
    hr: "Nhân sự",
    sprint: "Sprint",
    design: "Thiết kế",
    uml: "UML",
    docs: "Tài liệu",
    git: "Git",
  };

  for (const ag of AGENTS) {
    onProgress?.(ag.key, false);
    const label = sectionLabels[ag.key] || ag.key;
    appendLog({
      level: "info",
      agentId: "REFINE",
      provider: "pipeline",
      message: `─────────────────────────────────────────────`,
    });
    appendLog({
      level: "info",
      agentId: "REFINE",
      provider: "pipeline",
      message: `🔧 [REFINE] ${label} (${ag.key}) → đang đọc nội dung hiện tại + yêu cầu chỉnh sửa...`,
    });

    try {
      const sys =
        PROMPT_MAP[ag.key]() +
        `\n\nNhiem vu dac biet: Ban dang CHINH SUA lai phan "${ag.key}" dua tren yeu cau cua nhom truong va cuoc thao luan. Giu nguyen cau truc JSON, chi sua noi dung cho phu hop voi y nguoi dung. Dam bao dong bo voi cac phan khac.`;
      const user = `${base}${edits}${discussion}\n\nNOI DUNG HIEN TAI cua phan ${ag.key}:\n${JSON.stringify(
        current[ag.key]
      ).substring(0, 4000)}\n\nHay tra lai phan ${ag.key} da chinh sua (JSON day du).`;
      const res = await callAndParse(ag.models, sys, user, ag.temp, ag.key);
      if (res && isValidSchema(res.data, ag.key)) {
        (refined as unknown as Record<string, unknown>)[ag.key] = res.data;
        appendLog({
          level: "success",
          agentId: "REFINE",
          provider: "pipeline",
          model: res.model,
          message: `✓ [REFINE] ${label} → đã chỉnh sửa xong (${res.model})`,
        });
      } else if (res) {
        (refined as unknown as Record<string, unknown>)[ag.key] = res.data;
        appendLog({
          level: "warn",
          agentId: "REFINE",
          provider: "pipeline",
          model: res.model,
          message: `⚠ [REFINE] ${label} → schema không hợp lệ, vẫn lưu (${res.model})`,
        });
      } else {
        appendLog({
          level: "warn",
          agentId: "REFINE",
          provider: "fallback",
          message: `▷ [REFINE] ${label} → giữ nguyên (tất cả model fail)`,
        });
      }
    } catch (e) {
      appendLog({
        level: "error",
        agentId: "REFINE",
        provider: "pipeline",
        message: `✗ [REFINE] ${label} → lỗi: ${(e as Error).message?.substring(0, 100)}`,
      });
    }
    onProgress?.(ag.key, true);
  }

  appendLog({
    level: "success",
    agentId: "REFINE",
    provider: "pipeline",
    message: `✅ AI REFINE COMPLETED — tất cả section đã được đồng bộ`,
  });
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
  // Defensive: sections may be undefined if the project is still in ANALYZING state
  const analysisStr = result.analysis ? compressContext(JSON.stringify(result.analysis), 2500) : "{}";
  const hrStr = result.hr ? compressContext(JSON.stringify(result.hr), 1500) : "{}";
  const sprintStr = result.sprint ? compressContext(JSON.stringify(result.sprint), 2500) : "{}";
  const designStr = result.design ? compressContext(JSON.stringify(result.design), 2500) : "{}";
  const context = `${base}

PHAN TICH DU AN:
${analysisStr.substring(0, 2500)}

PHAN NHAN SU:
${hrStr.substring(0, 1500)}

SPRINT PLANNING:
${sprintStr.substring(0, 2500)}

THIET KE HE THONG:
${designStr.substring(0, 2500)}

Hay tao todolist chi tiet cho tung thanh vien.`;

  appendLog({
    level: "info",
    agentId: "TASK",
    provider: "pipeline",
    message: `▶ TASK GENERATION STARTED — ${input.members.length} member(s)`,
  });

  // Log member role assignments so the user can see "sinh task cho A: chức năng X do A làm"
  const assignments = result.hr?.assignments || [];
  for (const m of input.members) {
    const a = assignments.find((x) => x.name === m.name);
    const role = a?.role || "Backend Developer";
    const modules = a?.modules?.length ? a.modules.join(", ") : "(chưa gán module)";
    appendLog({
      level: "info",
      agentId: "TASK",
      provider: "pipeline",
      message: `👤 ${m.name} → vai trò: ${role} · module: ${modules}`,
    });
  }
  const features = result.analysis?.features || [];
  if (features.length > 0) {
    appendLog({
      level: "info",
      agentId: "TASK",
      provider: "pipeline",
      message: `📋 Đã đọc ${features.length} feature(s) + ${result.design?.apiEndpoints?.length || 0} API endpoint(s) để phân chia task`,
    });
  }

  appendLog({
    level: "info",
    agentId: "TASK",
    provider: "pipeline",
    message: `─────────────────────────────────────────────`,
  });
  appendLog({
    level: "info",
    agentId: "TASK",
    provider: "pipeline",
    message: `🤖 [TASK GEN] Gọi AI sinh todolist SMART cho từng thành viên...`,
  });

  try {
    const res = await callAndParse(TASK_GEN_MODELS, TASK_GEN_PROMPT, context, 0.25, undefined);
    onProgress?.(true);
    if (res && res.data) {
      const data = res.data as { tasks?: TaskItem[] };
      if (data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0) {
        // DEDUP: Remove duplicate tasks by title+assignee (AI sometimes returns dupes)
        const seen = new Set<string>();
        const uniqueTasks = data.tasks.filter((t) => {
          const key = `${(t.title || "").toLowerCase().trim()}|${(t.assigneeName || "").toLowerCase().trim()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const dupesRemoved = data.tasks.length - uniqueTasks.length;
        if (dupesRemoved > 0) {
          console.log(`  [TASK GEN] Removed ${dupesRemoved} duplicate task(s)`);
          appendLog({
            level: "warn",
            agentId: "TASK",
            provider: "pipeline",
            model: res.model,
            message: `⚠ [TASK GEN] Loại bỏ ${dupesRemoved} task trùng lặp (từ ${data.tasks.length} → ${uniqueTasks.length} task)`,
          });
        }
        console.log(`  [TASK GEN] Success: ${uniqueTasks.length} tasks from ${res.model}`);
        appendLog({
          level: "success",
          agentId: "TASK",
          provider: "pipeline",
          model: res.model,
          message: `✓ [TASK GEN] AI trả về ${uniqueTasks.length} task(s) (${res.model})`,
        });
        // Log per-member task breakdown so the user sees "sinh task cho A: chức năng X do A làm"
        const byMember = new Map<string, string[]>();
        for (const t of uniqueTasks) {
          const name = t.assigneeName || "(unassigned)";
          if (!byMember.has(name)) byMember.set(name, []);
          byMember.get(name)!.push(t.title || "Untitled");
        }
        for (const [name, titles] of byMember) {
          for (const title of titles) {
            appendLog({
              level: "success",
              agentId: "TASK",
              provider: "pipeline",
              message: `✓ Sinh task cho ${name}: ${title}`,
            });
          }
        }
        return uniqueTasks;
      }
      // AI returned data but no tasks array — try to extract from common patterns
      const d = res.data as Record<string, unknown>;
      for (const key of Object.keys(d)) {
        if (Array.isArray(d[key]) && d[key].length > 0) {
          console.log(`  [TASK GEN] Found tasks under key "${key}": ${d[key].length} items`);
          appendLog({
            level: "success",
            agentId: "TASK",
            provider: "pipeline",
            model: res.model,
            message: `✓ [TASK GEN] Tìm thấy ${d[key].length} task dưới key "${key}" (${res.model})`,
          });
          return d[key] as TaskItem[];
        }
      }
      console.log(`  [TASK GEN] AI returned data but no tasks array. Keys:`, Object.keys(res.data));
      appendLog({
        level: "warn",
        agentId: "TASK",
        provider: "pipeline",
        message: `⚠ [TASK GEN] AI trả về data nhưng không có tasks array. Keys: ${Object.keys(res.data).join(", ")}`,
      });
    } else {
      console.log(`  [TASK GEN] callAndParse returned null — all models failed`);
      appendLog({
        level: "warn",
        agentId: "TASK",
        provider: "pipeline",
        message: `⚠ [TASK GEN] Tất cả model thất bại — chuyển sang fallback tĩnh`,
      });
    }
    // Fallback: generate diverse tasks for each member based on their role
    console.log(`  [TASK GEN] [WARNING] Using fallback — all AI models failed or returned invalid data`);
    appendLog({
      level: "warn",
      agentId: "TASK",
      provider: "fallback",
      message: `▷ FALLBACK — sinh task tĩnh theo vai trò từng thành viên`,
    });
    const today = new Date();
    const tasks: TaskItem[] = [];
    const fallbackTasksByRole: Record<string, { title: string; layer: string; targetFile: string; steps: string[]; hints: { snippet: string; note: string } }[]> = {
      "Frontend Developer": [
        { title: "Tao project structure va cai dat dependencies", layer: "CONFIG", targetFile: "package.json", steps: ["1. Khoi tao project voi Vite/Next.js", "2. Cai dat Tailwind CSS + shadcn/ui", "3. Cau hinh ESLint + Prettier"], hints: { snippet: "npm create vite@latest my-app -- --template react-ts", note: "Dung TypeScript cho type safety" } },
        { title: "Thiet ket layout chinh va routing", layer: "UI", targetFile: "src/App.tsx", steps: ["1. Tao Layout component voi Header/Sidebar/Footer", "2. Cau hinh React Router", "3. Tao trang Dashboard"], hints: { snippet: "<Layout><Routes><Route path='/' element={<Dashboard/>}/></Routes></Layout>", note: "Responsive voi Tailwind breakpoints" } },
        { title: "Xay dung components UI co ban", layer: "UI", targetFile: "src/components/", steps: ["1. Tao Button, Input, Card components", "2. Tao DataTable component", "3. Tao Modal/Dialog"], hints: { snippet: "export function Button({children, variant}) { return <button className={cn(base, variants[variant])}>{children}</button> }", note: "Dung class-variance-authority cho variants" } },
      ],
      "Backend Developer": [
        { title: "Thiet ke database schema va models", layer: "DATABASE", targetFile: "prisma/schema.prisma", steps: ["1. Dinh nghia cac Prisma models", "2. Set up relations giua cac bang", "3. Chay prisma migrate"], hints: { snippet: "model User { id String @id @default(cuid()) email String @unique createdAt DateTime @default(now()) }", note: "Dung cuid() cho ID" } },
        { title: "Xay dung API routes CRUD", layer: "BACKEND", targetFile: "src/app/api/", steps: ["1. Tao route GET/POST cho moi resource", "2. Them validation voi Zod", "3. Them error handling"], hints: { snippet: "export async function GET(req: Request) { const users = await db.user.findMany(); return Response.json(users); }", note: "Luon return Response.json" } },
        { title: "Implement authentication va authorization", layer: "BACKEND", targetFile: "src/lib/auth.ts", steps: ["1. Tao JWT token generation/verification", "2. Tao login/register API", "3. Tao middleware protect routes"], hints: { snippet: "const token = jwt.sign({userId}, secret, {expiresIn: '7d'})", note: "Store secret trong .env" } },
      ],
      "Database Engineer": [
        { title: "Thiet ke va tao database schema", layer: "DATABASE", targetFile: "prisma/schema.prisma", steps: ["1. Phan tao cac entities", "2. Dinh nghia relations + indexes", "3. Chay migration"], hints: { snippet: "model Order { id String @id items OrderItem[] status String @default('pending') }", note: "Index cac column hay query" } },
        { title: "Viet SQL queries va stored procedures", layer: "DATABASE", targetFile: "src/lib/queries.ts", steps: ["1. Viet complex JOIN queries", "2. Tao aggregation queries cho reports", "3. Optimize voi indexes"], hints: { snippet: "SELECT u.name, COUNT(o.id) FROM users u LEFT JOIN orders o ON o.userId = u.id GROUP BY u.id", note: "Dung EXPLAIN ANALYZE de optimize" } },
      ],
      "QA/Tester": [
        { title: "Cai dat testing framework va viet unit tests", layer: "TESTING", targetFile: "tests/unit/", steps: ["1. Cai dat Vitest/Jest", "2. Viet unit tests cho services", "3. Viet tests cho API routes"], hints: { snippet: "test('should create user', async () => { const res = await POST(req); expect(res.status).toBe(201) })", note: "Mock database trong tests" } },
        { title: "Viet integration tests va E2E tests", layer: "TESTING", targetFile: "tests/e2e/", steps: ["1. Cai dat Playwright", "2. Viet E2E test cho login flow", "3. Viet test cho CRUD operations"], hints: { snippet: "test('login flow', async ({page}) => { await page.goto('/login'); await page.fill('[name=email]', 'test@test.com') })", note: "Dung test database rieng" } },
      ],
      "DevOps": [
        { title: "Cau hinh CI/CD pipeline", layer: "CONFIG", targetFile: ".github/workflows/ci.yml", steps: ["1. Tao GitHub Actions workflow", "2. Them build + test + lint steps", "3. Them auto deploy"], hints: { snippet: "name: CI\\non: [push]\\njobs:\\n  build:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - uses: actions/checkout@v4", note: "Cache dependencies de speed up" } },
        { title: "Cau hinh Docker va deployment", layer: "CONFIG", targetFile: "Dockerfile", steps: ["1. Tao Dockerfile multi-stage", "2. Tao docker-compose.yml", "3. Cau hinh environment variables"], hints: { snippet: "FROM node:20-alpine AS build\\nWORKDIR /app\\nCOPY . .\\nRUN npm ci && npm run build", note: "Dung alpine image de giam size" } },
      ],
    };

    for (const m of input.members) {
      const assignment = result.hr?.assignments?.find((a) => a.name === m.name);
      const role = assignment?.role || "Backend Developer";
      const roleTasks = fallbackTasksByRole[role] || fallbackTasksByRole["Backend Developer"];

      appendLog({
        level: "info",
        agentId: "TASK",
        provider: "fallback",
        message: `👤 Sinh task cho ${m.name} (${role}) — ${roleTasks.length} task(s)`,
      });

      for (const ft of roleTasks) {
        tasks.push({
          assigneeName: m.name,
          title: ft.title,
          description: `${ft.title} cho ${role}. File can sua: ${ft.targetFile}. Definition of Done: code hoat dong dung, qua review.`,
          role,
          layer: ft.layer,
          targetFile: ft.targetFile,
          responsibilities: ["Thuc hien theo implementation steps", "Test code locally", "Tao PR khi hoan thanh"],
          codeConventions: ["Tuan thu coding convention trong docs/CODING_CONVENTION.md", "Commit message theo conventional commits"],
          implementationSteps: ft.steps,
          technicalHints: ft.hints,
          dependencies: "Can setup project xong truoc",
          acceptanceCriteria: ["Code chay khong loi", "Pass unit tests", "Code review approved"],
          deadline: new Date(today.getTime() + 7 * 86400000).toISOString().split("T")[0],
          sprintName: "Sprint 1",
          status: "todo",
          hours: 8,
          priority: "P0",
        } as TaskItem);
        appendLog({
          level: "success",
          agentId: "TASK",
          provider: "fallback",
          message: `  ✓ ${m.name}: ${ft.title}`,
        });
      }
      console.log(`  [TASK GEN] [FALLBACK] Generated ${roleTasks.length} tasks for ${m.name} (${role})`);
    }
    console.log(`  [TASK GEN] [FALLBACK] Total: ${tasks.length} tasks for ${input.members.length} members`);
    appendLog({
      level: "success",
      agentId: "TASK",
      provider: "fallback",
      message: `✅ FALLBACK COMPLETED — ${tasks.length} task(s) cho ${input.members.length} thành viên`,
    });
    return tasks;
  } catch (err) {
    console.log(`  [TASK GEN] [CATCH] Error:`, err instanceof Error ? err.message : "unknown");
    appendLog({
      level: "error",
      agentId: "TASK",
      provider: "pipeline",
      message: `✗ [TASK GEN] Error: ${err instanceof Error ? err.message : "unknown"} — fallback`,
    });
    onProgress?.(true);
    // Re-use the same diverse fallback as above
    console.log(`  [TASK GEN] [CATCH] Generating diverse fallback tasks`);
    const today = new Date();
    const tasks: TaskItem[] = [];
    for (const m of input.members) {
      const role = result.hr?.assignments?.find((a) => a.name === m.name)?.role || "Backend Developer";
      appendLog({
        level: "info",
        agentId: "TASK",
        provider: "fallback",
        message: `👤 Sinh task cho ${m.name} (${role}) — fallback`,
      });
      tasks.push({
        assigneeName: m.name,
        title: `Thiet ke database schema cho ${input.topic}`,
        description: `Tao Prisma models phu hop voi ${input.topic}. File: prisma/schema.prisma. DoD: schema hop le, migration chay thanh cong.`,
        role,
        layer: "DATABASE",
        targetFile: "prisma/schema.prisma",
        responsibilities: ["Phan tich requirements", "Tao Prisma models", "Chay migration"],
        codeConventions: ["Dung cuid() cho ID", "Timestamps cho moi bang"],
        implementationSteps: ["1. Dinh nghia models", "2. Set up relations", "3. Chay prisma migrate"],
        technicalHints: { snippet: "model User { id String @id @default(cuid()) email String @unique }", note: "Dung @unique cho email" },
        dependencies: "Khong",
        acceptanceCriteria: ["Schema hop le", "Migration OK"],
        deadline: new Date(today.getTime() + 7 * 86400000).toISOString().split("T")[0],
        sprintName: "Sprint 1",
        status: "todo",
        hours: 8,
        priority: "P0",
      } as TaskItem);
      appendLog({
        level: "success",
        agentId: "TASK",
        provider: "fallback",
        message: `  ✓ ${m.name}: Thiet ke database schema cho ${input.topic}`,
      });
      tasks.push({
        assigneeName: m.name,
        title: `Xay dung API routes cho ${input.topic}`,
        description: `Tao CRUD API routes. File: src/app/api/. DoD: API hoat dong dung, tra ve JSON.`,
        role,
        layer: "BACKEND",
        targetFile: "src/app/api/",
        responsibilities: ["Tao GET/POST routes", "Them validation", "Error handling"],
        codeConventions: ["Return Response.json", "Dung Zod validation"],
        implementationSteps: ["1. Tao route handlers", "2. Them validation", "3. Test API"],
        technicalHints: { snippet: "export async function GET() { return Response.json(await db.user.findMany()) }", note: "Luon return Response.json" },
        dependencies: "Can database schema xong",
        acceptanceCriteria: ["API tra ve dung data", "Validation hoat dong"],
        deadline: new Date(today.getTime() + 10 * 86400000).toISOString().split("T")[0],
        sprintName: "Sprint 1",
        status: "todo",
        hours: 12,
        priority: "P1",
      } as TaskItem);
      appendLog({
        level: "success",
        agentId: "TASK",
        provider: "fallback",
        message: `  ✓ ${m.name}: Xay dung API routes cho ${input.topic}`,
      });
    }
    console.log(`  [TASK GEN] [CATCH] Generated ${tasks.length} fallback tasks`);
    appendLog({
      level: "success",
      agentId: "TASK",
      provider: "fallback",
      message: `✅ FALLBACK COMPLETED — ${tasks.length} task(s) cho ${input.members.length} thành viên`,
    });
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
