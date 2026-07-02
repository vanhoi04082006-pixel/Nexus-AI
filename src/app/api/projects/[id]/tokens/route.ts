// NEXUS AI - GET /api/projects/[id]/tokens
// Returns token usage stats for a project (leader only)

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";
import { getTotalTokensUsed } from "@/lib/openrouter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const access = await resolveAccess(id, token);
  if (!requireLeader(access)) {
    return Response.json({ error: "Leader access required" }, { status: 403 });
  }

  const logs = await db.tokenLog.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totalTokens = logs.reduce((sum, l) => sum + l.totalTokens, 0);
  const successCount = logs.filter((l) => l.success).length;
  const failCount = logs.length - successCount;

  // Group by agent
  const byAgent: Record<string, { tokens: number; calls: number; success: number }> = {};
  for (const l of logs) {
    if (!byAgent[l.agentId]) byAgent[l.agentId] = { tokens: 0, calls: 0, success: 0 };
    byAgent[l.agentId].tokens += l.totalTokens;
    byAgent[l.agentId].calls += 1;
    if (l.success) byAgent[l.agentId].success += 1;
  }

  // Group by API key
  const byKey: Record<string, number> = {};
  for (const l of logs) {
    const k = `Key #${l.apiKeyId}`;
    byKey[k] = (byKey[k] || 0) + l.totalTokens;
  }

  return Response.json({
    totalCalls: logs.length,
    totalTokens,
    successCount,
    failCount,
    byAgent: Object.entries(byAgent).map(([agentId, data]) => ({
      agentId,
      ...data,
    })),
    byKey,
    recentLogs: logs.slice(0, 20).map((l) => ({
      agentId: l.agentId,
      agentName: l.agentName,
      model: l.model,
      keyId: l.apiKeyId,
      tokens: l.totalTokens,
      success: l.success,
      duration: l.duration,
      time: l.createdAt.toISOString(),
    })),
  });
}
