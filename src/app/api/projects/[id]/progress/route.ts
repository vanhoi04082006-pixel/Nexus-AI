// NEXUS AI - GET /api/projects/[id]/progress
// Polling endpoint — returns the current state of the background pipeline.
// The frontend calls this every 2-3 seconds until status === "done" | "error".

import { getProgress } from "@/lib/pipeline-progress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const progress = getProgress(id);
  if (!progress) {
    // No progress record — either it expired (5 min) or the project ID is wrong.
    return Response.json(
      { status: "unknown", message: "Khong tim thay tien do. Co the da het han." },
      { status: 404 }
    );
  }
  return Response.json(progress);
}
