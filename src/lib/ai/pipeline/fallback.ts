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
    case "uml":
      const tables = (results.design?.dbTables || []).map((t) => t.name);
      const actors = (results.analysis?.actors || []).map((a) => a.name);
      const features = (results.analysis?.features || []).map((f) => f.name);
      const modules = results.analysis?.modules || [];
      const useCaseActors = actors.length > 0 ? actors : ["User"];
      const useCaseFeatures = features.length > 0 ? features : modules.length > 0 ? modules : ["Core"];
      const useCaseLines = useCaseActors.map((a, i) =>
        useCaseFeatures.map((f, j) => `Actor${i}["${a}"] --> F${j}["${f}"]`).join("\n    ")
      ).join("\n    ");
      const classTables = tables.length > 0 ? tables : modules.length > 0 ? modules : ["Core"];
      const classLines = classTables.map((t) =>
        `class ${t.replace(/[^A-Za-z0-9]/g, "")} {\n    +int id\n    +string name\n    +DateTime createdAt\n}`
      ).join("\n\n");
      const classRelations = classTables.length > 1
        ? `\n${classTables[0].replace(/[^A-Za-z0-9]/g, "")} "1" --> "*" ${classTables[1].replace(/[^A-Za-z0-9]/g, "")} : "has"` : "";
      const erdFallback = tables.length > 0
        ? `erDiagram\n${tables.map((t) => `    ${t.replace(/[^A-Za-z0-9_]/g, "_")} {\n        int id PK\n        string name\n    }`).join("\n")}\n${tables.length > 1 ? `    ${tables[0].replace(/[^A-Za-z0-9_]/g, "_")} ||--o{ ${tables[1].replace(/[^A-Za-z0-9_]/g, "_")} : "has"` : ""}`
        : `erDiagram\n    CORE {\n        int id PK\n        string name\n    }`;
      const seqActor = actors.length > 0 ? actors[0] : "User";
      return {
        useCase: results.uml?.useCase || `graph TD\n    ${useCaseLines}`,
        classDiagram: results.uml?.classDiagram || `classDiagram\n${classLines}${classRelations}`,
        erd: results.uml?.erd || erdFallback,
        sequence: results.uml?.sequence || `sequenceDiagram\n    participant U as ${seqActor}\n    participant S as System\n    U->>S: Request\n    S-->>U: Response`,
      };
    case "docs":
      return { readme: `# ${input.topic}\n\nTai lieu chua duoc tao tu dong.`, convention: "", apiStandard: "" };
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
