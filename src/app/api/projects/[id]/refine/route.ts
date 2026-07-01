// NEXUS AI - POST /api/projects/[id]/refine
// Leader triggers AI re-generation of all sections. Runs IN THE BACKGROUND.
// Returns immediately. Frontend polls GET /api/projects/[id]/refine/progress.

import { db } from "@/lib/db";
import { refineSections } from "@/lib/ai";
import { resolveAccess, requireLeader } from "@/lib/access";
import {
  reconstructInput,
  reconstructResult,
  SECTION_KEYS,
} from "@/app/api/projects/_lib/reconstruct";
import {
  initRefine,
  updateRefineSection,
  finishRefine,
} from "@/lib/pipeline-progress";
import type { SectionType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    const access = await resolveAccess(id, token);
    if (!requireLeader(access)) {
      return Response.json({ error: "Leader access required" }, { status: 403 });
    }

    const body = (await req.json()) as {
      editRequests: { section: SectionType; change: string }[];
      chatDiscussion: string;
    };

    if (!body || !Array.isArray(body.editRequests)) {
      return Response.json({ error: "editRequests array is required" }, { status: 400 });
    }

    const input = await reconstructInput(id);
    if (!input) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }
    const current = await reconstructResult(id);

    // Initialize progress tracker
    initRefine(id);

    // Run refine IN THE BACKGROUND
    (async () => {
      try {
        console.log(`>> [REFINE] Background refine started for project ${id}`);
        const refined = await refineSections(
          input,
          current,
          body.editRequests,
          body.chatDiscussion || "",
          (section: SectionType, done: boolean) => {
            updateRefineSection(id, section, done);
          }
        );

        // Persist all refined sections (bump version)
        for (const key of SECTION_KEYS) {
          const content = (refined as unknown as Record<string, unknown>)[key];
          if (content === undefined || content === null) continue;
          const existing = await db.analysis.findUnique({
            where: { projectId_type: { projectId: id, type: key } },
          });
          if (existing) {
            await db.analysis.update({
              where: { id: existing.id },
              data: {
                content: JSON.stringify(content),
                version: { increment: 1 },
              },
            });
          } else {
            await db.analysis.create({
              data: {
                projectId: id,
                type: key,
                content: JSON.stringify(content),
              },
            });
          }
        }

        finishRefine(id);
        console.log(`>> [REFINE] Background refine COMPLETED for project ${id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Refine failed";
        console.error(`>> [REFINE] Background refine FAILED:`, msg);
        finishRefine(id, msg);
      }
    })();

    return Response.json({ started: true });
  } catch (err) {
    return Response.json(
      { error: "Failed to start refine", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
