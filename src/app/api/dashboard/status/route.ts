// NEXUS AI - GET /api/dashboard/status
// Returns the real system status for the NEXUS AI Status widget:
//   - AI Agents: total / online / offline / busy / idle / error (from AgentStatus table)
//   - API Keys: total / active / expired / near-quota / provider (from env OPENROUTER_API_KEY_*)
//   - Pipeline: ready / running / paused / failed / deploying / success (from PipelineStatus)
//   - Database / Redis / Vector DB / Storage: from SystemStatus table (auto-seeded)
//
// Query: ?token=LEADER_TOKEN

import { db } from "@/lib/db";
import { updateSystemStatus } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Default 10 agents (mirror of /api/agents) — used to seed AgentStatus rows
// if none exist yet, so the widget always shows 10 agents on a fresh install.
const DEFAULT_AGENTS = [
  { id: "01", name: "Requirement Analyst", role: "Business Analyst" },
  { id: "02", name: "HR Planner", role: "HR Manager" },
  { id: "03", name: "Sprint Planner", role: "Scrum Master" },
  { id: "04", name: "System Architect", role: "Software Architect" },
  { id: "05", name: "UML Generator", role: "UML Expert" },
  { id: "06", name: "Technical Writer", role: "Tech Writer" },
  { id: "07", name: "Git / DevOps", role: "DevOps Engineer" },
  { id: "08", name: "Software Tester", role: "QA Engineer" },
  { id: "09", name: "Security Reviewer", role: "Security Architect" },
  { id: "10", name: "Quality Reviewer", role: "Senior Architect" },
];

async function seedAgentStatuses() {
  // Ensure all 10 default agents have an AgentStatus row (idle by default)
  for (const a of DEFAULT_AGENTS) {
    await db.agentStatus.upsert({
      where: { agentId: a.id },
      update: {},
      create: { agentId: a.id, name: a.name, role: a.role, status: "idle" },
    });
  }
}

async function seedSystemStatuses() {
  // Database — always connected (we're reading from it)
  await updateSystemStatus("database", "connected", "SQLite @ /db/custom.db", {
    type: "sqlite",
  });
  // Redis — not configured in this stack → mark as disconnected (honest)
  await updateSystemStatus(
    "redis",
    "disconnected",
    "Not configured (in-memory cache used instead)",
    { configured: false }
  );
  // Vector DB — not configured → disconnected
  await updateSystemStatus(
    "vector_db",
    "disconnected",
    "Not configured",
    { configured: false }
  );
  // Storage — local filesystem
  await updateSystemStatus("storage", "connected", "Local filesystem", {
    type: "local",
  });
}

function countApiKeys() {
  const keys: string[] = [];
  if (process.env.OPENROUTER_API_KEY) keys.push(process.env.OPENROUTER_API_KEY);
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`OPENROUTER_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return {
    total: keys.length,
    active: keys.length, // all configured keys are considered active
    expired: 0,
    nearQuota: 0,
    provider: "openrouter",
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return Response.json({ error: "Token required" }, { status: 401 });
  }

  // Seed defaults (idempotent upserts)
  await seedAgentStatuses();
  await seedSystemStatuses();

  // AI Agents
  const agents = await db.agentStatus.findMany();
  const agentStats = {
    total: agents.length,
    online: agents.filter((a) => a.status === "online").length,
    offline: agents.filter((a) => a.status === "offline").length,
    busy: agents.filter((a) => a.status === "busy").length,
    idle: agents.filter((a) => a.status === "idle").length,
    error: agents.filter((a) => a.status === "error").length,
  };

  // API Keys
  const apiKeys = countApiKeys();

  // Pipeline — find the most recent pipeline status across the user's projects
  const projects = await db.project.findMany({
    where: { leaderToken: token },
    select: { id: true, topic: true },
  });
  const projectIds = projects.map((p) => p.id);
  let pipeline = { status: "ready", currentAgent: "", progress: 0, stage: "", projectTopic: "" };
  if (projectIds.length > 0) {
    const recentPipeline = await db.pipelineStatus.findFirst({
      where: { projectId: { in: projectIds } },
      orderBy: { updatedAt: "desc" },
    });
    if (recentPipeline) {
      const p = projects.find((pr) => pr.id === recentPipeline.projectId);
      pipeline = {
        status: recentPipeline.status,
        currentAgent: recentPipeline.currentAgent,
        progress: recentPipeline.progress,
        stage: recentPipeline.stage,
        projectTopic: p?.topic || "",
      };
    }
  }

  // System subsystems
  const subsystems = await db.systemStatus.findMany();
  const subsystemMap: Record<string, { status: string; details: string; metadata: string }> = {};
  for (const s of subsystems) {
    subsystemMap[s.subsystem] = { status: s.status, details: s.details, metadata: s.metadata };
  }

  return Response.json({
    agents: agentStats,
    apiKeys,
    pipeline,
    database: subsystemMap.database || { status: "unknown", details: "" },
    redis: subsystemMap.redis || { status: "unknown", details: "" },
    vectorDb: subsystemMap.vector_db || { status: "unknown", details: "" },
    storage: subsystemMap.storage || { status: "unknown", details: "" },
  });
}
