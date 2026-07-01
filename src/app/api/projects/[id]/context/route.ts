// NEXUS AI - GET /api/projects/[id]/context
// Returns the long-term memory (ProjectContext) for a project.
// Used by AI on subsequent runs to "remember" the project without re-reading everything.

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ctx = await db.projectContext.findUnique({
    where: { projectId: id },
  });

  if (!ctx) {
    return Response.json({ hasContext: false }, { status: 404 });
  }

  let summary: unknown = null;
  try {
    summary = JSON.parse(ctx.summary);
  } catch {
    /* ignore */
  }

  return Response.json({
    hasContext: true,
    summary,
    runCount: ctx.runCount,
    tokensUsed: ctx.tokensUsed,
    updatedAt: ctx.updatedAt.toISOString(),
  });
}
