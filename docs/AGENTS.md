# 🤖 NEXUS AI — 10 AI Agents Documentation

> Tài liệu chi tiết về **10 AI Agents** trong pipeline NEXUS AI v0.3.0.
> Mỗi agent có một vai trò rõ ràng (Single Responsibility), đọc output của các agent trước đó làm context và sinh JSON schema-validated.
>
> **Source code:**
> - [`src/lib/ai/agents/definitions.ts`](../src/lib/ai/agents/definitions.ts) — Định nghĩa agent + model lists
> - [`src/lib/ai/pipeline/index.ts`](../src/lib/ai/pipeline/index.ts) — Pipeline orchestrator (8 phase)
> - [`src/lib/ai/prompts/index.ts`](../src/lib/ai/prompts/index.ts) — Prompt của từng agent + sub-task
> - [`src/lib/schemas.ts`](../src/lib/schemas.ts) — Zod schemas + `.refine()` validation

---

## 📑 Mục lục

1. [Tổng quan Agents](#-tổng-quan-agents)
2. [Bảng tổng hợp](#-bảng-tổng-hợp)
3. [Chi tiết từng Agent (01–10)](#-chi-tiết-từng-agent-0110)
4. [Split Architecture](#-split-architecture)
5. [Agent 10 — Quality Reviewer (Safe Merge Logic)](#-agent-10--quality-reviewer-safe-merge-logic)
6. [Anti-rate-limit Features](#-anti-rate-limit-features)

---

## 🧠 Tổng quan Agents

NEXUS AI v0.3.0 sử dụng **10 AI Agents** chạy tuần tự + song song trong pipeline 8 phase:

```
Phase 0: Planner (pre-plan modules)
    ↓
Phase 1: Agent 01 → Agent 02 → Agent 03 (tuần tự)
    ↓
Phase 2: Agent 04 ⚡split + Agent 05 ⚡split + Agent 06 ⚡split + Agent 07 (song song)
    ↓
Phase 3: Agent 08 + Agent 09 (song song)
    ↓
Phase 4: Retry failed agents (5s wait)
    ↓
Phase 5: Static fallback (no crash)
    ↓
Phase 5.5: Output Normalizer + Consistency Checker + Self-Healing Mermaid
    ↓
Phase 6: Agent 10 — Quality Reviewer (merge + Zod + feedback loop)
```

> ⚡ **split** = Agent được tách thành 3 sub-task (Single Responsibility) — xem [Split Architecture](#-split-architecture).

---

## 📊 Bảng tổng hợp

| # | ID | Name | Section | Phase | Mode | Models | Temp | Required | Split? |
|---|----|------|---------|-------|------|--------|------|----------|--------|
| 01 | `01` | Requirement Analyst | `analysis` | 1 | sequential | 9 | 0.20 | ✅ | — |
| 02 | `02` | HR Planner | `hr` | 1 | sequential | 6 | 0.25 | ❌ | — |
| 03 | `03` | Sprint Planner | `sprint` | 1 | sequential | 6 | 0.20 | ❌ | — |
| 04 | `04` | System Architect | `design` | 2 | parallel | 5 | 0.15 | ✅ | ⚡ 3 sub-tasks |
| 05 | `05` | UML Generator | `uml` | 2 | parallel | 5 | 0.10 | ❌ | ⚡ 3 sub-tasks |
| 06 | `06` | Technical Writer | `docs` | 2 | parallel | 5 | 0.35 | ❌ | ⚡ 3 sub-tasks |
| 07 | `07` | Git / DevOps | `git` | 2 | parallel | 4 | 0.15 | ❌ | — |
| 08 | `08` | Software Tester | `test` | 3 | parallel | 4 | 0.20 | ❌ | — |
| 09 | `09` | Security Reviewer | `security` | 3 | parallel | 4 | 0.15 | ❌ | — |
| 10 | `10` | Quality Reviewer | (merge) | 6 | solo | 3 | 0.10 | ✅ | merge + Zod |

> **Ghi chú:**
> - `Required = ✅` → nếu fail sau retry, pipeline ném lỗi (`"Tat ca Agent bat buoc (Analyst + Architect) deu fail"`).
> - `Temp` = temperature của model. Agent logic (UML, Security) dùng temp thấp (0.10–0.15) để output deterministic. Agent sáng tạo (Docs) dùng 0.35.
> - Agent 10 **không** nằm trong `AGENTS[]` array — nó chạy riêng ở Phase 6 với `REVIEWER_MODELS`.

---

## 🔍 Chi tiết từng Agent (01–10)

### Agent 01 — Requirement Analyst

| Thuộc tính | Giá trị |
|---|---|
| **ID / Section** | `01` / `analysis` |
| **Phase** | 1 (sequential) |
| **Required** | ✅ Yes |
| **Temperature** | 0.20 — cân bằng giữa sáng tạo và chính xác |
| **Models** | 9 (nemotron-3-ultra, qwen3-next-80b, gpt-oss-120b, hermes-3-405b, gemma-4-31b, gemma-4-26b, nemotron-3-super, llama-3.3-70b, nemotron-3-nano) |

**Input context:**
- `input.topic`, `input.description`, `input.purpose` — từ người dùng
- `input.extraInfo.requirements` — modules do Planner Agent (Phase 0) đề xuất
- Không đọc output của agent nào (chạy đầu tiên)

**Output schema (MIN_KEYS):**
```ts
{
  desc: string;        // mô tả tổng quan dự án
  techStack: {
    frontend, backend, database, cache: { name, ver, reason };
    tools: string[];
  };
  teamSize: number;
  estimatedDuration: string;
  complexity: string;
  features: Array<{ name, module, pri }>;
  actors: Array<{ name, desc }>;
  modules: string[];
}
```

**Fallback behavior:** Nếu retry fail → throw `"Tat ca Agent bat buoc..."` (vì required). Pipeline dừng.

---

### Agent 02 — HR Planner

| Thuộc tính | Giá trị |
|---|---|
| **ID / Section** | `02` / `hr` |
| **Phase** | 1 (sequential) |
| **Required** | ❌ No |
| **Temperature** | 0.25 — cần sáng tạo để ghép nhân sự vào vai trò |
| **Models** | 6 (gemma-4-31b, nemotron-3-ultra, qwen3-next-80b, gpt-oss-120b, nemotron-3-super, gemma-4-26b) |

**Input context:**
- `input.members` — danh sách thành viên (name, email, strengths, weaknesses)
- `results.analysis.modules` — modules từ Agent 01 (để chia module cho từng thành viên)
- `results.analysis.actors` — actor từ Agent 01

**Output schema:**
```ts
{
  assignments: Array<{
    name, role, reason, modules: string[],
    workload: number, strengths, weaknesses
  }>;
  coverage: string;
  risks: Array<{ risk, mitigation }>;
}
```

**Fallback behavior:** Nếu fail → `fallback("hr")` sinh static assignments từ `input.members` (mỗi member 1 role mặc định).

---

### Agent 03 — Sprint Planner

| Thuộc tính | Giá trị |
|---|---|
| **ID / Section** | `03` / `sprint` |
| **Phase** | 1 (sequential) |
| **Required** | ❌ No |
| **Temperature** | 0.20 — sprint cần structured, không cần sáng tạo |
| **Models** | 6 (nemotron-3-ultra, qwen3-next-80b, nemotron-3-super, gpt-oss-120b, gemma-4-31b, gemma-4-26b) |

**Input context:**
- `results.analysis` — features + modules từ Agent 01
- `results.hr.assignments` — workload mỗi member từ Agent 02
- `input.members` — để gán `assignee` vào task

**Output schema:**
```ts
{
  totalSprints: number;
  sprintDuration: string;     // "2 weeks"
  sprints: Array<{
    name, start, end: string;
    goals: string[];
    tasks: Array<{ task, assignee, hours, status }>;
    color: string;
  }>;
  milestones: Array<{ date, event }>;
}
```

**Fallback behavior:** Sinh 1 sprint mặc định với tất cả tasks gán cho leader.

---

### Agent 04 — System Architect ⚡ Split

| Thuộc tính | Giá trị |
|---|---|
| **ID / Section** | `04` / `design` |
| **Phase** | 2 (parallel) |
| **Required** | ✅ Yes |
| **Temperature** | 0.15 — schema/API cần deterministic |
| **Models** | 5 (gpt-oss-120b, nemotron-3-ultra, qwen3-coder, nemotron-3-super, gemma-4-31b) |
| **Split** | ⚡ 3 sub-tasks (xem [Split Architecture](#-split-architecture)) |

**Input context:**
- `results.analysis.techStack` — tech stack từ Agent 01
- `results.analysis.features` + `modules` — để thiết kế DB schema + API endpoints
- `results.hr.assignments` — để gán module ownership

**Sub-tasks:**
1. **DB Schema** (`designDbPrompt`) → `dbTables: Array<{ name, columns: string[], relations: string[] }>`
2. **API Endpoints** (`designApiPrompt`) → `apiEndpoints: Array<{ method, path, desc, auth, body, response }>`
3. **Architecture** (`designArchPrompt`) → `architectureDesc: string` + `folderStructure: string[]`

**Merge output:** `{ dbTables, apiEndpoints, folderStructure, architectureDesc }`

**Fallback behavior:** Nếu **1 sub-task fail** → chỉ sub-task đó fallback (static data); các sub-task khác vẫn dùng được → output tổng vẫn đầy đủ. Nếu **tất cả sub-task fail** → throw (vì required).

---

### Agent 05 — UML Generator ⚡ Split

| Thuộc tính | Giá trị |
|---|---|
| **ID / Section** | `05` / `uml` |
| **Phase** | 2 (parallel) |
| **Required** | ❌ No |
| **Temperature** | 0.10 — Mermaid syntax phải chính xác tuyệt đối |
| **Models** | 5 (gpt-oss-120b, nemotron-3-ultra, qwen3-coder, gemma-4-31b, nemotron-3-super) |
| **Split** | ⚡ 3 sub-tasks |

**Input context:**
- `results.analysis.actors` + `features` → Use Case diagram
- `results.design.dbTables` → ERD
- `results.analysis.modules` + `results.design.apiEndpoints` → Class diagram
- `results.sprint.sprints` → Sequence diagram (flow chính)

**Sub-tasks:**
1. **Use Case** (`umlUseCasePrompt`) → `useCase: string` (Mermaid `flowchart` hoặc `usecase`)
2. **Class + ERD** (`umlClassErdPrompt`) → `classDiagram: string` + `erd: string` (Mermaid `classDiagram` + `erDiagram`)
3. **Sequence** (`umlSequencePrompt`) → `sequence: string` (Mermaid `sequenceDiagram`)

**Merge output:** `{ useCase, classDiagram, erd, sequence }`

**Zod `.refine()` validation:**
```ts
classDiagram: z.string().refine(s => s.trim().startsWith("classDiagram"), "classDiagram must start with classDiagram")
erd: z.string().refine(s => s.trim().startsWith("erDiagram"), "erd must start with erDiagram")
sequence: z.string().refine(s => s.trim().startsWith("sequenceDiagram"), "sequence must start with sequenceDiagram")
```

**Self-Healing Mermaid:** Nếu sub-task fail validation, `cleanMermaidSyntax()` + `healUMLData()` sẽ auto-fix syntax (thêm missing `end`, sửa arrow `->` → `-->`, v.v.) trước khi fallback.

---

### Agent 06 — Technical Writer ⚡ Split

| Thuộc tính | Giá trị |
|---|---|
| **ID / Section** | `06` / `docs` |
| **Phase** | 2 (parallel) |
| **Required** | ❌ No |
| **Temperature** | 0.35 — cao nhất, vì docs cần sáng tạo + giọng văn tự nhiên |
| **Models** | 5 (gemma-4-31b, gpt-oss-120b, nemotron-3-ultra, gemma-4-26b, nemotron-3-super) |
| **Split** | ⚡ 3 sub-tasks |

**Input context:**
- `results.analysis` — tech stack, features, modules
- `results.design` — DB schema, API endpoints, folder structure
- `results.git` — repo URL, branch strategy (để thêm vào README)

**Sub-tasks:**
1. **README** (`docReadmePrompt`) → `readme: string` (Markdown — title, install, usage, scripts)
2. **Coding Convention** (`docConventionPrompt`) → `convention: string` (ESLint, Prettier, naming, commit)
3. **API Standard** (`docApiStandardPrompt`) → `apiStandard: string` (REST convention, status codes, error format)

**Merge output:** `{ readme, convention, apiStandard }`

**Fallback behavior:** Sub-task nào fail → dùng template mặc định (README với placeholder, Convention rút gọn, API Standard RESTful cơ bản).

---

### Agent 07 — Git / DevOps

| Thuộc tính | Giá trị |
|---|---|
| **ID / Section** | `07` / `git` |
| **Phase** | 2 (parallel) |
| **Required** | ❌ No |
| **Temperature** | 0.15 — commands phải chính xác |
| **Models** | 4 (cohere/north-mini-code, gpt-oss-120b, qwen3-coder, nemotron-3-super) |

**Input context:**
- `results.analysis.techStack` — để quyết định CI/CD (Node → GitHub Actions, Python → PyPI, v.v.)
- `results.design.folderStructure` — để tạo `.gitignore` + branch strategy phù hợp

**Output schema:**
```ts
{
  gitCommands: string[];    // init, add, commit, push commands
  branchStrategy: string;   // "Git Flow" | "Trunk-based" | "GitHub Flow"
  issueTemplate: string;    // Markdown issue template
  repoUrl: string;          // github.com/org/repo
}
```

**Fallback behavior:** Sinh static git commands + GitHub Flow strategy + default issue template.

---

### Agent 08 — Software Tester

| Thuộc tính | Giá trị |
|---|---|
| **ID / Section** | `08` / `test` |
| **Phase** | 3 (parallel) |
| **Required** | ❌ No |
| **Temperature** | 0.20 — test cases cần structured |
| **Models** | 4 (qwen3-coder, gpt-oss-120b, nemotron-3-super, gemma-4-31b) |

**Input context:**
- `results.analysis.features` → test cases cho từng feature
- `results.design.apiEndpoints` → API integration tests
- `results.uml.sequence` → E2E test scenarios theo flow

**Output schema:**
```ts
{
  testStrategy: string;     // overview: unit/integration/E2E/API/performance
  unitTests: Array<{ file, cases: string[] }>;
  integrationTests?: Array<{ name, steps: string[] }>;
  e2eTests?: Array<{ scenario, steps: string[] }>;
  performanceTests?: string[];
}
```

**Fallback behavior:** Sinh unit tests template cho 3 file chính (auth, db, api).

---

### Agent 09 — Security Reviewer

| Thuộc tính | Giá trị |
|---|---|
| **ID / Section** | `09` / `security` |
| **Phase** | 3 (parallel) |
| **Required** | ❌ No |
| **Temperature** | 0.15 — security cần chính xác, không được "sáng tạo" ra lỗ hổng |
| **Models** | 4 (gpt-oss-120b, nemotron-3-ultra, nemotron-3-super, gemma-4-31b) |

**Input context:**
- `results.analysis.techStack` — để list CVE known
- `results.design.apiEndpoints` — để review auth flow
- `results.git` — để review branch protection

**Output schema:**
```ts
{
  threats: Array<{ type, severity, description, mitigation }>;
  owaspTop10: Array<{ category, status, note }>;
  authFlow: string;        // flowchart hoặc mô tả text
  recommendations: string[];
}
```

**Fallback behavior:** Sinh static threats (XSS, SQLi, CSRF, IDOR) + auth flow mặc định (OAuth2).

> ⚠️ **Lưu ý:** Agent 10 (Quality Reviewer) **KHÔNG** nằm cùng `security` section. Trong v0.2.x nó từng nằm trong Phase 3 → gây overwrite output của Agent 09. v0.3.0 đã tách ra Phase 6 riêng.

---

### Agent 10 — Quality Reviewer

| Thuộc tính | Giá trị |
|---|---|
| **ID / Section** | `10` / (merge — không có section riêng) |
| **Phase** | 6 (solo, sau Phase 5.5 Normalizer) |
| **Required** | ✅ Yes (implicit — luôn chạy) |
| **Temperature** | 0.10 — review phải deterministic |
| **Models** | 3 (`REVIEWER_MODELS`: gpt-oss-120b, nemotron-3-super, gemma-4-31b) |

Xem chi tiết [bên dưới](#-agent-10--quality-reviewer-safe-merge-logic).

---

## 🧩 Split Architecture

**v0.3.0** giới thiệu **Split Prompt + Merge Output**: 3 agent phức tạp (`design`, `uml`, `docs`) được tách thành **3 sub-task** nhỏ. Mỗi sub-task:

1. Có prompt riêng (Single Responsibility — 1 việc duy nhất)
2. Có Zod schema riêng với `.refine()` validation
3. Chạy độc lập với model list riêng (có thể dùng model chuyên cho coder cho sub-task code, model sáng tạo cho sub-task docs)
4. Có fallback riêng — nếu 1 sub-task fail, **không ảnh hưởng** các sub-task khác

### Tại sao cần split?

| Vấn đề (v0.2.x) | Giải pháp (v0.3.0 split) |
|---|---|
| Prompt quá dài → AI mất focus, skip section, JSON thiếu field | Mỗi sub-task 1 prompt ngắn, focus 100% vào 1 việc |
| 1 call fail → nguyên agent fallback → mất công sức | 1 sub-task fail → chỉ sub-task đó fallback, các sub-task khác giữ nguyên |
| Quality output thấp vì agent phải làm quá nhiều việc cùng lúc | Mỗi sub-task có thể chọn model phù hợp (coder cho schema, creative cho docs) |
| Mermaid syntax hay sai (classDiagram/erDiagram) | `.refine()` validate từng diagram type + Self-Healing Mermaid auto-fix |

### Bảng split

| Agent | Sub-task 1 | Sub-task 2 | Sub-task 3 | Merge output |
|---|---|---|---|---|
| **04 Design** | DB Schema | API Endpoints | Architecture | `{ dbTables, apiEndpoints, folderStructure, architectureDesc }` |
| **05 UML** | Use Case | Class + ERD | Sequence | `{ useCase, classDiagram, erd, sequence }` |
| **06 Docs** | README | Coding Convention | API Standard | `{ readme, convention, apiStandard }` |

### Implement

```ts
// src/lib/ai/pipeline/index.ts
async function runSplitDesign(ag, ctx, i) {
  const [db, api, arch] = await Promise.allSettled([
    callAndParse(ag.models, designDbPrompt(), ctx, 0.15, "design-db"),
    callAndParse(ag.models, designApiPrompt(), ctx, 0.15, "design-api"),
    callAndParse(ag.models, designArchPrompt(), ctx, 0.15, "design-arch"),
  ]);
  // Merge — mỗi sub-task có schema riêng, fail 1 cái không ảnh hưởng cái kia
  return {
    dbTables:    db.status  === "fulfilled" && isValidSchema(db.value?.data,  "design-db")  ? db.value.data  : fallback("design-db"),
    apiEndpoints: api.status === "fulfilled" && isValidSchema(api.value?.data, "design-api") ? api.value.data : fallback("design-api"),
    folderStructure: arch.status === "fulfilled" ? arch.value?.data?.folderStructure : [],
    architectureDesc: arch.status === "fulfilled" ? arch.value?.data?.architectureDesc : "",
  };
}
```

> Tương tự cho `runSplitUML` và `runSplitDocs` — xem [`src/lib/ai/pipeline/index.ts`](../src/lib/ai/pipeline/index.ts).

---

## 🛡️ Agent 10 — Quality Reviewer (Safe Merge Logic)

Agent 10 là **agent đặc biệt** — không sinh section mới, mà **review + merge** output của 9 agent trước đó. Nó chạy ở **Phase 6**, sau khi Phase 5.5 (Normalizer + Consistency Checker) đã chuẩn hóa output.

### Workflow

```
9 agent outputs (analysis, hr, sprint, design, uml, docs, git, test, security)
    ↓ compressContext(JSON.stringify(results), 10000)
    ↓
Reviewer Prompt + full results JSON
    ↓ callAndParse(REVIEWER_MODELS, ..., temp=0.1)
    ↓
Reviewer trả object JSON với 9 keys (có thể sửa từng section)
    ↓ SAFE MERGE LOOP
    ↓
Merged output (final ProjectResult)
```

### Safe Merge Logic (4 cases)

```ts
const merged = { ...results };  // start with original results
for (const key of Object.keys(results) as SectionType[]) {
  const rv = rev[key];  // reviewer's version of this section
  // Case 1: Reviewer không trả section này → giữ results gốc
  if (rv == null) { continue; }
  // Case 2: Reviewer trả section rỗng → giữ results gốc
  if (typeof rv === "object" && rv !== null && Object.keys(rv).length === 0) { continue; }
  // Case 3: Reviewer trả section nhưng schema sai → giữ results gốc
  if (!isValidSchema(rv, key)) {
    merged[key] = results[key];
    appendLog(`⚠ Section "${key}" từ reviewer sai schema → giữ data gốc`);
    continue;
  }
  // Case 4: Reviewer trả section hợp lệ → dùng reviewer's version
  merged[key] = rv;
}
```

### Zod Validation (Feedback Loop)

Mỗi section sau khi Reviewer sửa phải vượt qua **Zod schema** (cùng schema với agent gốc):

```ts
import { analysisSchema, hrSchema, sprintSchema, designSchema, /* ... */ } from "@/lib/schemas";

function isValidSchema(data: unknown, key: SectionType): boolean {
  const schema = {
    analysis: analysisSchema, hr: hrSchema, sprint: sprintSchema,
    design: designSchema, uml: umlSchema, docs: docsSchema,
    git: gitSchema, test: testSchema, security: securitySchema,
  }[key];
  return schema.safeParse(data).success;
}
```

### Feedback Loop (Logging)

Mỗi section merge được log chi tiết để debug:

```
📋 [REVIEW] Merge: 3 section(s) từ reviewer, 6 section(s) giữ data gốc
⚠ [REVIEW] Section "uml" từ reviewer sai schema → giữ data gốc
```

→ Người dùng có thể xem Live Log Console để biết Reviewer đã sửa gì và tại sao.

### Fallback behavior

- Nếu Reviewer fail hoàn toàn (network, 429, JSON không parse được) → **trả nguyên `results` gốc** (9 section của 9 agent), không mất data.
- Nếu Reviewer trả section mới mà `results` không có → chỉ chấp nhận nếu `VALID_SECTION_KEYS.has(key)` (filter garbage keys).

> 💡 **Design principle:** Reviewer chỉ **cải thiện**, không bao giờ **làm hỏng**. Safe merge đảm bảo output cuối luôn ≥ output gốc.

---

## ⚡ Anti-rate-limit Features

Để chạy 10 agent × 5 model = ~50 LLM calls mỗi pipeline, NEXUS AI v0.3.0 có nhiều lớp chống rate-limit:

| Feature | Mô tả | Implement |
|---|---|---|
| **Multi-key rotation** | Tự switch key khi 429 (hỗ trợ 100+ keys, comma-separated trong `OPENROUTER_API_KEY`) | `src/lib/openrouter.ts` |
| **60s wait cho 429** | Đợi đúng 60s (không spam) trước retry | `src/lib/openrouter.ts` |
| **Circuit Breaker** | 3 fail liên tiếp → skip model 3 phút | `src/lib/openrouter.ts` |
| **Dead Model Recovery** | All keys 429 → mark dead 2 phút, auto-recover | `src/lib/openrouter.ts` |
| **Health Score** | Priority sort model theo success rate (preserved across restarts qua `modelHealth.json`) | `src/lib/openrouter.ts` |
| **Adaptive Timeout** | Timeout riêng cho từng model (model chậm → timeout dài hơn) | `src/lib/openrouter.ts` |
| **In-memory cache** | Prompt cache 1h TTL (chỉ cho `temp < 0.5`) | `src/lib/ai/cache/semanticCache.ts` |
| **Structured Outputs** | `response_format: { type: "json_object" }` để ép JSON | `src/lib/ai/pipeline/runner.ts` |
| **Self-Healing Mermaid** | `cleanMermaidSyntax` + `healUMLData` auto-fix Mermaid syntax | `src/lib/ai/utils/helpers.ts` |

---

## 🔗 Liên kết

- [Pipeline architecture chi tiết](./ARCHITECTURE.md)
- [Zod schemas + `.refine()`](./CONTRIBUTING.md#zod-lenient-schemas)
- [API endpoints cho agents](./API.md#agents)
- [Đóng góp Agent mới (9 bước)](./CONTRIBUTING.md#them-agent-moi)
