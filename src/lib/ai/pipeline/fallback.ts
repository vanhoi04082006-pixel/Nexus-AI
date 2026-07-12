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

      // ===== USE CASE (graph TD) — detailed, actors connect to RELEVANT features =====
      const useCaseActors = actors.length > 0 ? actors : ["User", "Admin", "Manager"];
      const useCaseFeatures = features.length > 0 ? features
        : modules.length > 0 ? modules
        : ["Đăng ký tài khoản", "Đăng nhập hệ thống", "Xem danh sách", "Tạo mới bản ghi", "Cập nhật thông tin", "Xóa bản ghi", "Tìm kiếm", "Báo cáo thống kê"];
      let useCaseLines = "";
      // FIX: Smart assignment — admin/manager gets admin features, user gets user features
      useCaseActors.forEach((actor, i) => {
        const actorLower = actor.toLowerCase();
        const isAdmin = actorLower.includes("admin") || actorLower.includes("quản trị") || actorLower.includes("quản lý");
        const isManager = actorLower.includes("manager") || actorLower.includes("quản lý");
        // Admin/Manager: connect to admin-type features (last half)
        // User/Member: connect to user-type features (first half)
        const featuresPerActor = Math.max(2, Math.ceil(useCaseFeatures.length / Math.max(useCaseActors.length, 2)));
        let startIdx, endIdx;
        if (isAdmin || isManager) {
          startIdx = Math.floor(useCaseFeatures.length / 2);
          endIdx = useCaseFeatures.length;
        } else {
          startIdx = 0;
          endIdx = Math.ceil(useCaseFeatures.length / 2);
        }
        // Limit to featuresPerActor
        const assigned = useCaseFeatures.slice(startIdx, endIdx).slice(0, featuresPerActor);
        assigned.forEach((f, j) => {
          const realIdx = startIdx + j;
          useCaseLines += `    Actor${i}["${actor}"] --> UC${realIdx}["${f}"]\n`;
        });
      });
      // Add include/extend relationships
      if (useCaseFeatures.length >= 2) {
        useCaseLines += `    UC0["${useCaseFeatures[0]}"] -.->|extend| UC1["${useCaseFeatures[1]}"]\n`;
      }
      if (useCaseFeatures.length >= 3) {
        useCaseLines += `    UC0["${useCaseFeatures[0]}"] -->|include| UC2["${useCaseFeatures[2]}"]\n`;
      }
      if (useCaseFeatures.length >= 4) {
        useCaseLines += `    UC1["${useCaseFeatures[1]}"] -->|include| UC3["${useCaseFeatures[3]}"]\n`;
      }
      const useCaseFallback = `graph TD\n    ${useCaseLines.trim()}`;

      // ===== CLASS DIAGRAM — detailed, multiple relationship types =====
      const classTables = dbTables.length > 0 ? dbTables : modules.slice(0, 6).map((m: string) => ({ name: m, columns: ["id: int", "name: string", "createdAt: DateTime"], relations: [] as string[] }));
      let classLines = "";
      let classRels = "";
      const classNames = classTables.map((t) => ascii(t.name));
      classTables.forEach((t, i) => {
        const cols = (t.columns || ["id: int", "name: string", "createdAt: DateTime"]).slice(0, 5);
        const attrLines = cols.map((c: string) => `    +${c}`).join("\n");
        classLines += `class ${classNames[i]} {\n${attrLines}\n    +findAll()\n    +findById(id)\n    +create(data)\n    +update(id, data)\n    +delete(id)\n}\n\n`;
      });
      // FIX: Generate diverse relationships (not just 1:*)
      for (let i = 0; i < classNames.length - 1; i++) {
        const relType = i % 4;
        switch (relType) {
          case 0: // Association with cardinality
            classRels += `${classNames[i]} "1" --> "*" ${classNames[i + 1]} : "has"\n`;
            break;
          case 1: // Composition
            classRels += `${classNames[i]} *-- ${classNames[i + 1]} : "owns"\n`;
            break;
          case 2: // Aggregation
            classRels += `${classNames[i]} o-- ${classNames[i + 1]} : "contains"\n`;
            break;
          case 3: // Dependency
            classRels += `${classNames[i]} ..> ${classNames[i + 1]} : "uses"\n`;
            break;
        }
      }
      // Add inheritance if 3+ tables
      if (classNames.length >= 3) {
        classRels += `${classNames[0]} <|-- ${classNames[2]} : "extends"\n`;
      }
      // Add 1:1 relationship if 4+ tables
      if (classNames.length >= 4) {
        classRels += `${classNames[0]} "1" --> "1" ${classNames[3]} : "belongs to"\n`;
      }
      const classFallback = `classDiagram\n${classLines}${classRels.trim()}`;

      // ===== ERD — detailed, diverse cardinality =====
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
        // FIX: Generate diverse cardinality (1:N, 1:1, N:M, N:1)
        for (let i = 0; i < dbTables.length - 1; i++) {
          const relType = i % 3;
          const t1 = ascii_(dbTables[i].name);
          const t2 = ascii_(dbTables[i + 1].name);
          switch (relType) {
            case 0: erdRels += `    ${t1} ||--o{ ${t2} : "has"\n`; break; // 1:N
            case 1: erdRels += `    ${t1} ||--|| ${t2} : "belongs to"\n`; break; // 1:1
            case 2: erdRels += `    ${t1} }o--o{ ${t2} : "associates"\n`; break; // N:M
          }
        }
      } else {
        // Fallback for no DB tables — use modules with realistic schema
        const erdTableNames = modules.length > 0 ? modules.slice(0, 5) : ["users", "products", "orders", "order_items", "categories"];
        erdTableNames.forEach((m, i) => {
          if (i === 0) {
            erdTables += `    ${ascii_(m)} {\n        int id PK\n        string email\n        string password\n        string role\n        datetime created_at\n    }\n`;
          } else if (i === 1) {
            erdTables += `    ${ascii_(m)} {\n        int id PK\n        string name\n        text description\n        decimal price\n        int category_id FK\n    }\n`;
          } else {
            erdTables += `    ${ascii_(m)} {\n        int id PK\n        string name\n        datetime created_at\n    }\n`;
          }
        });
        for (let i = 0; i < erdTableNames.length - 1; i++) {
          const relType = i % 3;
          const t1 = ascii_(erdTableNames[i]);
          const t2 = ascii_(erdTableNames[i + 1]);
          switch (relType) {
            case 0: erdRels += `    ${t1} ||--o{ ${t2} : "has"\n`; break; // 1:N
            case 1: erdRels += `    ${t1} ||--|| ${t2} : "belongs to"\n`; break; // 1:1
            case 2: erdRels += `    ${t1} }o--o{ ${t2} : "associates"\n`; break; // N:M
          }
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
    case "git": {
      const slug = input.topic.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const techFe = results.analysis?.techStack?.frontend?.name || "Next.js";
      return {
        gitCommands: `# Khởi tạo repository
git init
git remote add origin https://github.com/your-org/${slug}.git

# Tạo nhánh develop
git checkout -b develop
git push -u origin develop

# Tạo feature branch
git checkout -b feature/auth-module

# Commit thay đổi
git add .
git commit -m "feat: implement auth module with JWT"

# Merge vào develop
git checkout develop
git merge feature/auth-module
git push origin develop

# Tạo release
git checkout -b release/v1.0.0
git checkout main
git merge release/v1.0.0
git tag v1.0.0
git push origin main --tags`,
        branchStrategy: `Git Flow với 2 nhánh chính: main (production) và develop (integration).

Workflow:
1. Feature branches (feature/*) tách từ develop, merge qua Pull Request
2. Release branches (release/*) cho chuẩn bị phát hành
3. Hotfix branches (hotfix/*) tách từ main cho sửa lỗi khẩn cấp
4. Tag versions trên main: v1.0.0, v1.1.0, v2.0.0

Quy tắc:
- Không push trực tiếp lên main
- PR require ít nhất 1 review
- Commit message theo Conventional Commits (feat:, fix:, docs:, refactor:)`,
        issueTemplate: `## Mô tả
[Mô tả ngắn gọn vấn đề hoặc tính năng]

## Loại
- [ ] Bug
- [ ] Feature
- [ ] Enhancement
- [ ] Documentation

## Steps to Reproduce (cho Bug)
1.
2.
3.

## Expected Behavior
[Kết quả mong đợi]

## Actual Behavior
[Kết quả thực tế]

## Environment
- OS: [Windows/Mac/Linux]
- Browser: [Chrome/Firefox/Safari]
- ${techFe} version: [x.x.x]

## Additional Context
[Ảnh chụp màn hình, logs, hoặc thông tin bổ sung]`,
        repoUrl: `https://github.com/your-org/${slug}`,
      };
    }
    case "test": {
      const testModules = (results.analysis?.modules || ["Auth", "Core", "Dashboard"]).slice(0, 5);
      return {
        testStrategy: `Chiến lược kiểm thử theo hình kim tự tháp (Test Pyramid):

1. Unit Tests (70%): Kiểm tra từng function/method độc lập
   - Sử dụng Vitest/Jest
   - Mock dependencies (DB, API, external services)
   - Mục tiêu: 80% code coverage

2. Integration Tests (20%): Kiểm tra tương tác giữa modules
   - Test API endpoints với real database (test DB)
   - Test authentication flow end-to-end
   - Sử dụng Supertest + Prisma test client

3. E2E Tests (10%): Kiểm tra luồng người dùng hoàn chỉnh
   - Sử dụng Playwright
   - Test critical user journeys (login, create, edit, delete)
   - Chạy trên CI/CD trước deploy

4. Performance Tests: Kiểm tra tải (load testing)
   - Sử dụng k6 hoặc Artillery
   - Test 100 concurrent users
   - Response time < 200ms cho 95% requests`,
        unitTests: testModules.map((mod) => ({
          module: mod,
          cases: [
            { name: `test_${mod.toLowerCase().replace(/[^a-z0-9]/g, "_")}_create`, desc: `Test tạo ${mod} hợp lệ`, input: "valid data", expected: "201 Created" },
            { name: `test_${mod.toLowerCase().replace(/[^a-z0-9]/g, "_")}_validation`, desc: `Test validation ${mod} dữ liệu sai`, input: "invalid data", expected: "400 Bad Request" },
            { name: `test_${mod.toLowerCase().replace(/[^a-z0-9]/g, "_")}_not_found`, desc: `Test tìm ${mod} không tồn tại`, input: "non-existent ID", expected: "404 Not Found" },
            { name: `test_${mod.toLowerCase().replace(/[^a-z0-9]/g, "_")}_update`, desc: `Test cập nhật ${mod}`, input: "valid update data", expected: "200 OK" },
          ],
        })),
        integrationTests: [
          { name: "auth_flow_integration", desc: "Test luồng đăng nhập hoàn chỉnh", flow: "POST /api/auth/login → GET /api/profile → POST /api/logout" },
          { name: "crud_integration", desc: "Test CRUD operations cho tất cả modules", flow: "POST → GET → PATCH → DELETE cho mỗi module" },
          { name: "permission_integration", desc: "Test phân quyền RBAC", flow: "Login as user → try admin endpoint → expect 403" },
        ],
        e2eTests: [
          { name: "user_signup_to_dashboard", desc: "Người dùng đăng ký → đăng nhập → xem dashboard", steps: ["1. Visit /signup", "2. Fill form + submit", "3. Verify redirect to /login", "4. Login with new credentials", "5. Verify redirect to /dashboard", "6. Verify dashboard content"] },
          { name: "admin_manage_users", desc: "Admin quản lý người dùng", steps: ["1. Login as admin", "2. Visit /admin/users", "3. Create new user", "4. Edit user", "5. Delete user", "6. Verify user removed"] },
        ],
        apiTests: (results.design?.apiEndpoints || []).slice(0, 5).map((ep) => ({
          endpoint: ep.path,
          method: ep.method,
          cases: `Test ${ep.method} ${ep.path}: valid input → ${ep.method === "POST" ? "201" : "200"}; invalid input → 400; unauthorized → 401`,
        })),
        performanceTests: [
          { scenario: "Load test 100 concurrent users", metric: "Response time p95", target: "< 200ms" },
          { scenario: "Stress test 500 concurrent users", metric: "Error rate", target: "< 1%" },
          { scenario: "Database query performance", metric: "Query time", target: "< 50ms" },
        ],
        bugReportTemplate: `## Bug Report Template

**Tiêu đề:** [Mô tả ngắn gọn]
**Mức độ nghiêm trọng:** Critical / High / Medium / Low
**Môi trường:** Dev / Staging / Production

**Mô tả:**
[Chi tiết vấn đề]

**Steps to Reproduce:**
1. [Bước 1]
2. [Bước 2]
3. [Bước 3]

**Kết quả mong đợi:**
[What should happen]

**Kết quả thực tế:**
[What actually happened]

**Logs/Screenshots:**
[Attach nếu có]`,
      };
    }
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
