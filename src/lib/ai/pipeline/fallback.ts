// ai/pipeline/fallback.ts — Fallback data generators for failed agents

import type { ProjectResult, ProjectInput, SectionType } from "@/lib/types";

/**
 * Generate fallback data for a section when all AI models fail.
 * Uses data from already-completed sections to create basic but
 * non-empty output.
 */
export function fallback(
  key: SectionType,
  input: ProjectInput,
  results: Partial<ProjectResult>
): unknown {
  const d = new Date().toISOString().split("T")[0];
  const dEnd = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
  const members = input.members;
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
          frontend: { name: "React", ver: "18", reason: "Pho bien" },
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
        modules: ["Auth", "Core", "Dashboard"],
      };
    case "hr":
      return {
        assignments: members.map((m) => ({
          name: m.name, role: "Developer", reason: "Mac dinh",
          modules: ["Core"], workload: 50, strengths: m.strengths, weaknesses: m.weaknesses,
        })),
        coverage: "80%",
        risks: [{ risk: "Thieu nhan su", mitigation: "Outsource" }],
      };
    case "sprint":
      return {
        totalSprints: 2, sprintDuration: "2 tuan",
        sprints: [
          { name: "Sprint 1", start: d, end: dEnd, goals: ["Core features"], tasks: [], color: "#00d4aa" },
          { name: "Sprint 2", start: dEnd, end: new Date(Date.now() + 28 * 86400000).toISOString().split("T")[0], goals: ["Polish & Test"], tasks: [], color: "#38bdf8" },
        ],
        milestones: [{ date: dEnd, event: "Sprint 1 demo" }],
      };
    case "design":
      return { architectureDesc: "N/A", dbTables: [], apiEndpoints: [], folderStructure: "N/A" };
    case "uml": {
      const dbTables = results.design?.dbTables || [];
      const actors = (results.analysis?.actors || []).map((a) => a.name);
      const features = (results.analysis?.features || []).map((f) => f.name);
      const modules = results.analysis?.modules || [];
      const apiEndpoints = results.design?.apiEndpoints || [];
      const techFe = results.analysis?.techStack?.frontend?.name || "Frontend";
      const techBe = results.analysis?.techStack?.backend?.name || "Backend";

      // ASCII-safe names for Mermaid node IDs
      const ascii = (s: string) => s.replace(/[^A-Za-z0-9]/g, "");
      const ascii_ = (s: string) => s.replace(/[^A-Za-z0-9_]/g, "_");

      // ===== USE CASE (graph TD) — rich with actors, features, include/extend =====
      const useCaseActors = actors.length > 0 ? actors : ["User", "Admin"];
      const useCaseFeatures = features.length > 0 ? features : modules.length > 0 ? modules : ["Đăng ký", "Đăng nhập", "Quản lý", "Báo cáo"];
      let useCaseLines = "";
      useCaseActors.forEach((actor, i) => {
        // Each actor connects to relevant features (distribute evenly)
        const featuresPerActor = Math.max(2, Math.ceil(useCaseFeatures.length / useCaseActors.length));
        const startIdx = i * featuresPerActor;
        for (let j = startIdx; j < Math.min(startIdx + featuresPerActor, useCaseFeatures.length); j++) {
          useCaseLines += `    Actor${i}["${actor}"] --> UC${j}["${useCaseFeatures[j]}"]\n`;
        }
      });
      // Add include/extend relationships
      if (useCaseFeatures.length >= 2) {
        useCaseLines += `    UC0["${useCaseFeatures[0]}"] -.->|extend| UC1["${useCaseFeatures[1]}"]\n`;
      }
      if (useCaseFeatures.length >= 3) {
        useCaseLines += `    UC0["${useCaseFeatures[0]}"] -->|include| UC2["${useCaseFeatures[2]}"]\n`;
      }
      const useCaseFallback = `graph TD\n    ${useCaseLines.trim()}`;

      // ===== CLASS DIAGRAM — use actual DB columns, multiple relations =====
      const classTables = dbTables.length > 0 ? dbTables : modules.slice(0, 6).map((m: string) => ({ name: m, columns: ["id: int", "name: string", "createdAt: DateTime"], relations: [] as string[] }));
      let classLines = "";
      let classRels = "";
      const classNames = classTables.map((t) => ascii(t.name));
      classTables.forEach((t, i) => {
        const cols = (t.columns || ["id: int", "name: string", "createdAt: DateTime"]).slice(0, 5);
        const attrLines = cols.map((c: string) => `    +${c}`).join("\n");
        classLines += `class ${classNames[i]} {\n${attrLines}\n    +findAll()\n    +findById(id)\n    +create(data)\n    +update(id, data)\n    +delete(id)\n}\n\n`;
      });
      // Generate relations between consecutive tables
      for (let i = 0; i < classNames.length - 1; i++) {
        classRels += `${classNames[i]} "1" --> "*" ${classNames[i + 1]} : "has"\n`;
      }
      // Add inheritance if 3+ tables
      if (classNames.length >= 3) {
        classRels += `${classNames[0]} <|-- ${classNames[2]} : "extends"\n`;
      }
      const classFallback = `classDiagram\n${classLines}${classRels.trim()}`;

      // ===== ERD — use actual DB columns + relations =====
      let erdTables = "";
      let erdRels = "";
      if (dbTables.length > 0) {
        dbTables.forEach((t) => {
          const cols = (t.columns || ["id: int", "name: string"]).slice(0, 5);
          const colLines = cols.map((c: string) => {
            const parts = c.split(":").map((s: string) => s.trim());
            const colName = parts[0] || "field";
            const colType = (parts[1] || "string").toLowerCase();
            const isPk = colName.toLowerCase() === "id";
            const isFk = colName.toLowerCase().includes("id") && !isPk;
            const modifier = isPk ? " PK" : isFk ? " FK" : "";
            return `        ${colType} ${ascii_(colName)}${modifier}`;
          }).join("\n");
          erdTables += `    ${ascii_(t.name)} {\n${colLines}\n    }\n`;
        });
        // Generate FK relations
        for (let i = 0; i < dbTables.length - 1; i++) {
          erdRels += `    ${ascii_(dbTables[i].name)} ||--o{ ${ascii_(dbTables[i + 1].name)} : "has"\n`;
        }
      } else {
        // Fallback for no DB tables — use modules
        const erdTableNames = modules.length > 0 ? modules.slice(0, 5) : ["User", "Product", "Order", "OrderItem"];
        erdTableNames.forEach((m) => {
          erdTables += `    ${ascii_(m)} {\n        int id PK\n        string name\n        datetime created_at\n    }\n`;
        });
        for (let i = 0; i < erdTableNames.length - 1; i++) {
          erdRels += `    ${ascii_(erdTableNames[i])} ||--o{ ${ascii_(erdTableNames[i + 1])} : "has"\n`;
        }
      }
      const erdFallback = `erDiagram\n${erdTables}${erdRels.trim()}`;

      // ===== SEQUENCE — 2 flows, 5+ participants =====
      const seqActor = actors.length > 0 ? actors[0] : "User";
      const firstApi = apiEndpoints[0]?.path || "/api/resource";
      const secondApi = apiEndpoints[1]?.path || "/api/resource/:id";
      const sequenceFallback = `sequenceDiagram
    participant U as ${seqActor}
    participant FE as ${techFe}
    participant API as ${techBe} API
    participant SVC as Service
    participant DB as Database

    %% Flow 1: Create ${firstApi}
    U->>FE: Submit form
    FE->>API: POST ${firstApi}
    API->>SVC: validate + process
    SVC->>DB: INSERT
    DB-->>SVC: Record created
    SVC-->>API: Success response
    API-->>FE: 201 Created
    FE-->>U: Show success

    %% Flow 2: Get ${secondApi}
    U->>FE: View detail
    FE->>API: GET ${secondApi}
    API->>SVC: findById
    SVC->>DB: SELECT
    DB-->>SVC: Record found
    SVC-->>API: Data
    API-->>FE: 200 OK
    FE-->>U: Display detail`;

      return {
        useCase: results.uml?.useCase || useCaseFallback,
        classDiagram: results.uml?.classDiagram || classFallback,
        erd: results.uml?.erd || erdFallback,
        sequence: results.uml?.sequence || sequenceFallback,
      };
    }
    case "docs": {
      const techFe = results.analysis?.techStack?.frontend?.name || "React";
      const techBe = results.analysis?.techStack?.backend?.name || "Node.js";
      const techDb = results.analysis?.techStack?.database?.name || "PostgreSQL";
      const modules = (results.analysis?.modules || ["Core", "Auth", "Dashboard"]).slice(0, 8);
      const features = (results.analysis?.features || []).slice(0, 10).map((f) => f.name);

      const readme = `# ${input.topic}

## Giới thiệu
${input.description || "Dự án được phân tích tự động bởi NEXUS AI."}

## Mục đích
${input.purpose || "Đồ án tốt nghiệp"}

## Tech Stack
- **Frontend**: ${techFe}
- **Backend**: ${techBe}
- **Database**: ${techDb}
- **Cache**: ${results.analysis?.techStack?.cache?.name || "Redis"}

## Modules
${modules.map((m) => `- ${m}`).join("\n")}

## Tính năng chính
${features.length > 0 ? features.map((f) => `- ${f}`).join("\n") : "- Core functionality"}

## Cài đặt
\`\`\`bash
# Clone repo
git clone <repo-url>
cd ${input.topic.toLowerCase().replace(/[^a-z0-9]/g, "-")}

# Install dependencies
bun install  # hoặc npm install

# Setup database
bun run db:push

# Chạy dev server
bun run dev  # http://localhost:3000
\`\`\`

## Cấu trúc thư mục
\`\`\`
src/
├── app/              # Next.js App Router
│   ├── api/          # API routes
│   ├── layout.tsx
│   └── page.tsx
├── components/       # React components
│   ├── ui/           # shadcn/ui components
│   └── nexus/        # Feature components
├── lib/              # Utilities
│   ├── ai.ts         # AI pipeline
│   ├── db.ts         # Prisma client
│   └── schemas.ts    # Zod schemas
├── prisma/
│   └── schema.prisma # Database schema
└── package.json
\`\`\`

## Đội ngũ
${members.map((m) => `- **${m.name}** — ${results.hr?.assignments?.find((a) => a.name === m.name)?.role || "Developer"}`).join("\n")}

## License
MIT
`;

      const convention = `# Coding Convention

## TypeScript
- Sử dụng TypeScript strict mode
- Type mọi function params + return values
- Tránh \`any\` — dùng \`unknown\` + type guard

## Naming
- **Files**: kebab-case (\`user-service.ts\`)
- **Components**: PascalCase (\`UserProfile.tsx\`)
- **Functions**: camelCase (\`getUserById()\`)
- **Constants**: UPPER_SNAKE (\`MAX_RETRY\`)
- **Types/Interfaces**: PascalCase (\`UserDto\`)

## React Components
- Functional components + hooks (no class)
- \`"use client"\` directive cho client components
- Props interface đặt ngay trước component
- Memoize với \`memo\` + \`useMemo\` + \`useCallback\`

## API Routes
- \`export const dynamic = "force-dynamic"\`
- \`export const runtime = "nodejs"\`
- Validate input với Zod
- Try-catch mọi logic, return \`{ error }\` + status code

## Database (Prisma)
- CUID cho primary keys
- \`@@index\` cho foreign keys
- \`onDelete: Cascade\` cho owned relations
- Migration trước khi deploy

## Git
- Conventional commits: \`feat:\`, \`fix:\`, \`refactor:\`, \`docs:\`, \`chore:\`
- Branch: \`main\` (production), \`dev\` (staging), \`feature/*\`, \`fix/*\`
- PR require review + pass lint

## ESLint + Prettier
- ESLint: \`next/core-web-vitals\` + \`@typescript-eslint\`
- Prettier: 2 spaces, single quote, no semicolon (hoặc theo config)
`;

      const apiStandard = `# API Standard

## RESTful Conventions
- **GET**    \`/api/resources\`         — List (with pagination)
- **GET**    \`/api/resources/:id\`    — Get one
- **POST**   \`/api/resources\`        — Create
- **PATCH**  \`/api/resources/:id\`    — Update (partial)
- **PUT**    \`/api/resources/:id\`    — Replace (full)
- **DELETE** \`/api/resources/:id\`    — Delete

## Response Format
\`\`\`json
// Success
{ "data": {...}, "meta": { "page": 1, "total": 100 } }

// Error
{ "error": "Message", "details": "Optional details" }
\`\`\`

## Status Codes
- \`200\` OK — Success
- \`201\` Created — Resource created
- \`400\` Bad Request — Validation error
- \`401\` Unauthorized — Missing/invalid token
- \`403\` Forbidden — No permission
- \`404\` Not Found
- \`429\` Too Many Requests — Rate limited
- \`500\` Server Error

## Authentication
- JWT trong \`Authorization: Bearer <token>\` header
- Access token: 15 phút
- Refresh token: 7 ngày (httpOnly cookie)

## Pagination
\`GET /api/resources?page=1&limit=20&sort=createdAt&order=desc\`

## Error Handling
- Try-catch mọi route handler
- Log error + return user-friendly message
- Never expose stack trace trong production

## Rate Limiting
- 100 req/phút per IP
- 5 req/phút cho login/register

## Modules API
${modules.map((m) => `### ${m}\n- \`GET /api/${m.toLowerCase().replace(/[^a-z0-9]/g, "-")}\`\n- \`POST /api/${m.toLowerCase().replace(/[^a-z0-9]/g, "-")}\`\n- \`GET /api/${m.toLowerCase().replace(/[^a-z0-9]/g, "-")}/:id\`\n- \`PATCH /api/${m.toLowerCase().replace(/[^a-z0-9]/g, "-")}/:id\`\n- \`DELETE /api/${m.toLowerCase().replace(/[^a-z0-9]/g, "-")}/:id\``).join("\n\n")}
`;

      return { readme, convention, apiStandard };
    }
    case "git":
      return { gitCommands: "", branchStrategy: "", issueTemplate: "", repoUrl: "https://github.com/your-org/project" };
    case "test":
      return {
        testStrategy: "Test pyramid: unit > integration > E2E.",
        unitTests: (results.analysis?.modules || ["Core"]).slice(0, 5).map((mod) => ({
          module: mod,
          cases: [
            { name: `test_${mod}_create`, desc: "Test create", input: "valid", expected: "201" },
            { name: `test_${mod}_validation`, desc: "Test validation", input: "invalid", expected: "400" },
          ],
        })),
        integrationTests: [{ name: "auth_flow", desc: "Test auth", flow: "POST /api/auth/login" }],
        e2eTests: [{ name: "signup_to_dashboard", desc: "Signup flow", steps: ["1. Visit /signup", "2. Submit"] }],
        apiTests: [], performanceTests: [], bugReportTemplate: "",
      };
    case "security":
      return {
        threats: [
          { risk: "SQL Injection", severity: "High", mitigation: "Use Prisma parameterized queries" },
          { risk: "XSS", severity: "Medium", mitigation: "Sanitize input + CSP headers" },
          { risk: "CSRF", severity: "Medium", mitigation: "CSRF tokens" },
        ],
        authFlow: "JWT + refresh token. Login → access token (15m) + refresh token (7d).",
        authzModel: "RBAC: admin, user, guest roles.",
        dataProtection: "Encrypt at rest (AES-256), TLS in transit.",
        owaspChecklist: [
          { category: "A01 Broken Access Control", status: "Pass", note: "RBAC implemented" },
          { category: "A02 Cryptographic Failures", status: "Pass", note: "AES-256 + TLS" },
        ],
        rateLimit: "100 req/min per IP, 5 req/min for login.",
        secrets: "Environment variables, never hardcoded.",
      };
    default:
      return {};
  }
}
