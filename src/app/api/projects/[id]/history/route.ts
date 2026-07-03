// NEXUS AI - GET /api/projects/[id]/history
// Returns all activity logs for a project (pipeline, init, refine, etc.)

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(_req.url);
  const token = url.searchParams.get("token");

  const access = await resolveAccess(id, token);
  if (!access) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  const logs = await db.activityLog.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    take: 200, // limit to last 200 entries
  });

  return Response.json({
    logs: logs.map((l) => ({
      id: l.id,
      type: l.type,
      status: l.status,
      title: l.title,
      details: l.details,
      agentId: l.agentId,
      model: l.model,
      duration: l.duration,
      logCount: l.logCount,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
