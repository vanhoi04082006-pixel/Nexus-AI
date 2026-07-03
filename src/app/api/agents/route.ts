// NEXUS AI - GET /api/agents
// Returns default 10 AI agent configurations (static from code, not DB)
// This is read-only for the Agent Hub dashboard view

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_AGENTS = [
  { id: "01", name: "Requirement Analyst", role: "Business Analyst", model: "nvidia/nemotron-3-ultra-550b-a55b:free", provider: "openrouter", temperature: 0.20, status: "online", description: "Phân tích yêu cầu, tech stack, features, actors, modules", skills: ["Analysis", "Planning", "Documentation"] },
  { id: "02", name: "HR Planner", role: "HR Manager", model: "google/gemma-4-31b-it:free", provider: "openrouter", temperature: 0.25, status: "online", description: "Phân vai trò, workload, rủi ro cho thành viên", skills: ["HR", "Planning", "Risk Assessment"] },
  { id: "03", name: "Sprint Planner", role: "Scrum Master", model: "nvidia/nemotron-3-ultra-550b-a55b:free", provider: "openrouter", temperature: 0.20, status: "online", description: "Chia sprint, gán task, deadline, milestones", skills: ["Agile", "Sprint Planning", "Timeline"] },
  { id: "04", name: "System Architect", role: "Software Architect", model: "openai/gpt-oss-120b:free", provider: "openrouter", temperature: 0.15, status: "online", description: "Thiết kế DB schema, API endpoints, folder structure", skills: ["Architecture", "Database", "API Design", "DDD"] },
  { id: "05", name: "UML Generator", role: "UML Expert", model: "openai/gpt-oss-120b:free", provider: "openrouter", temperature: 0.10, status: "online", description: "Sinh 4 diagram: Use Case, Class, ERD, Sequence", skills: ["UML", "Mermaid", "Diagramming"] },
  { id: "06", name: "Technical Writer", role: "Tech Writer", model: "google/gemma-4-31b-it:free", provider: "openrouter", temperature: 0.35, status: "online", description: "Viết README, Coding Convention, API Standard", skills: ["Documentation", "Markdown", "Technical Writing"] },
  { id: "07", name: "Git / DevOps", role: "DevOps Engineer", model: "cohere/north-mini-code:free", provider: "openrouter", temperature: 0.15, status: "online", description: "Git commands, branch strategy, issue template, CI/CD", skills: ["Git", "Docker", "CI/CD", "DevOps"] },
  { id: "08", name: "Software Tester", role: "QA Engineer", model: "qwen/qwen3-coder:free", provider: "openrouter", temperature: 0.20, status: "online", description: "Sinh test plan: unit, integration, E2E, API, performance tests", skills: ["Testing", "QA", "Automation", "Performance"] },
  { id: "09", name: "Security Reviewer", role: "Security Architect", model: "openai/gpt-oss-120b:free", provider: "openrouter", temperature: 0.15, status: "online", description: "Phân tích threats, auth flow, OWASP Top 10, rate limiting", skills: ["Security", "OWASP", "Auth", "Encryption"] },
  { id: "10", name: "Quality Reviewer", role: "Senior Architect", model: "openai/gpt-oss-120b:free", provider: "openrouter", temperature: 0.10, status: "online", description: "Tổng hợp + đồng bộ tất cả sections, Zod validation, feedback loop", skills: ["Review", "Architecture", "Quality Assurance"] },
];

export async function GET() {
  return Response.json({
    agents: DEFAULT_AGENTS,
    stats: {
      total: DEFAULT_AGENTS.length,
      online: DEFAULT_AGENTS.filter((a) => a.status === "online").length,
      working: 0,
      idle: DEFAULT_AGENTS.length,
      error: 0,
    },
  });
}
