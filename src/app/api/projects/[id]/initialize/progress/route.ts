// NEXUS AI - GET /api/projects/[id]/initialize/progress
// Polling endpoint for the background task generation.

import { getInitialize } from "@/lib/pipeline-progress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const prog = getInitialize(id);
  if (!prog) {
    return Response.json({ status: "unknown" }, { status: 404 });
  }
  return Response.json(prog);
}
