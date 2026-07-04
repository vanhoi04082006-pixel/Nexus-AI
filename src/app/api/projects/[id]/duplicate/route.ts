// NEXUS AI - POST /api/projects/[id]/duplicate
// Creates a copy of a project (topic, description, purpose, techStack, tags, members)
// without copying analyses/tasks/emails. The new project gets a fresh leaderToken
// and DRAFT status so the user can re-run the pipeline.

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    const access = await resolveAccess(id, token);
    if (!access) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const original = await db.project.findUnique({
      where: { id },
      include: {
        members: { select: { name: true, email: true, strengths: true, weaknesses: true } },
      },
    });

    if (!original) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    // Create the duplicate
    const duplicate = await db.project.create({
      data: {
        topic: `${original.topic} (bản sao)`,
        description: original.description,
        purpose: original.purpose,
        extraInfo: original.extraInfo,
        status: "DRAFT",
        leaderName: original.leaderName,
        leaderEmail: original.leaderEmail,
        leaderSmtpPassword: original.leaderSmtpPassword,
        techStack: original.techStack,
        tags: original.tags,
        coverColor: original.coverColor,
        priority: original.priority,
      },
    });

    // Copy members
    if (original.members.length > 0) {
      await db.member.createMany({
        data: original.members.map((m) => ({
          projectId: duplicate.id,
          name: m.name,
          email: m.email,
          strengths: m.strengths,
          weaknesses: m.weaknesses,
        })),
      });
    }

    return Response.json({
      success: true,
      projectId: duplicate.id,
      leaderToken: duplicate.leaderToken,
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to duplicate project", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
