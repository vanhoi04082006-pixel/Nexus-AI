// NEXUS AI - PUT /api/projects/[id]/section
// Leader edits a single section's content directly.

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import type { SectionType } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_SECTIONS: SectionType[] = [
  "analysis",
  "hr",
  "sprint",
  "design",
  "uml",
  "docs",
  "git",
];

export async function PUT(
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
      section: SectionType;
      content: unknown;
    };

    if (!body || !body.section || !VALID_SECTIONS.includes(body.section)) {
      return Response.json({ error: "Invalid section" }, { status: 400 });
    }
    if (body.content === undefined || body.content === null) {
      return Response.json({ error: "Content is required" }, { status: 400 });
    }

    const contentStr = JSON.stringify(body.content);

    const existing = await db.analysis.findUnique({
      where: { projectId_type: { projectId: id, type: body.section } },
    });

    let updated;
    if (existing) {
      updated = await db.analysis.update({
        where: { id: existing.id },
        data: {
          content: contentStr,
          version: { increment: 1 },
        },
      });
    } else {
      updated = await db.analysis.create({
        data: {
          projectId: id,
          type: body.section,
          content: contentStr,
        },
      });
    }

    // Log the project update (section edit) for the dashboard activity feed
    try {
      await logActivity({
        projectId: id,
        type: "PROJECT_UPDATED",
        status: "SUCCESS",
        title: `${access.name} cập nhật dự án`,
        details: `Cập nhật section ${body.section} (v${updated.version})`,
        actorName: access.name,
        actorEmail: access.email,
        actorRole: "Leader",
        actionUrl: `/?p=${id}&token=${token}&tab=${body.section}`,
        actionLabel: "Mở Section",
      });
    } catch { /* non-fatal */ }

    return Response.json({
      section: updated.type,
      content: JSON.parse(updated.content),
      version: updated.version,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to update section", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
