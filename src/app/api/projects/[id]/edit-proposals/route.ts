// NEXUS AI - GET/POST /api/projects/[id]/edit-proposals
// Any member can propose an edit. Anyone can list proposals.

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";
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

export async function GET(
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

    const proposals = await db.editProposal.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      include: { member: true },
    });

    return Response.json({
      proposals: proposals.map((p) => ({
        id: p.id,
        projectId: p.projectId,
        memberId: p.memberId,
        memberName: p.member?.name || null,
        section: p.section,
        requestedChange: p.requestedChange,
        status: p.status,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to fetch edit proposals", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}

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

    const body = (await req.json()) as {
      section: SectionType;
      requestedChange: string;
    };

    if (!body || !body.section || !VALID_SECTIONS.includes(body.section)) {
      return Response.json({ error: "Invalid section" }, { status: 400 });
    }
    if (!body.requestedChange || !body.requestedChange.trim()) {
      return Response.json({ error: "requestedChange is required" }, { status: 400 });
    }

    const proposal = await db.editProposal.create({
      data: {
        projectId: id,
        memberId: access.role === "member" ? access.memberId : null,
        section: body.section,
        requestedChange: body.requestedChange.trim(),
        status: "PENDING",
      },
      include: { member: true },
    });

    return Response.json({
      proposal: {
        id: proposal.id,
        projectId: proposal.projectId,
        memberId: proposal.memberId,
        memberName: proposal.member?.name || access.name,
        section: proposal.section,
        requestedChange: proposal.requestedChange,
        status: proposal.status,
        createdAt: proposal.createdAt,
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to create edit proposal", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
