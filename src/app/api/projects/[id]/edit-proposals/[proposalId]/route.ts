// NEXUS AI - PUT /api/projects/[id]/edit-proposals/[proposalId]
// Leader approves or rejects an edit proposal.

import { db } from "@/lib/db";
import { resolveAccess, requireLeader } from "@/lib/access";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_STATUSES = ["APPROVED", "REJECTED"];

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  try {
    const { id, proposalId } = await params;
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    const access = await resolveAccess(id, token);
    if (!requireLeader(access)) {
      return Response.json({ error: "Leader access required" }, { status: 403 });
    }

    const body = (await req.json()) as { status: string };
    if (!body || typeof body.status !== "string" || !VALID_STATUSES.includes(body.status)) {
      return Response.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const proposal = await db.editProposal.findUnique({
      where: { id: proposalId },
    });
    if (!proposal || proposal.projectId !== id) {
      return Response.json({ error: "Proposal not found" }, { status: 404 });
    }

    const updated = await db.editProposal.update({
      where: { id: proposalId },
      data: { status: body.status },
      include: { member: true },
    });

    // Log proposal-approved/rejected activity for the dashboard feed
    try {
      await logActivity({
        projectId: id,
        type: body.status === "APPROVED" ? "PROPOSAL_APPROVED" : "PROPOSAL_REJECTED",
        status: "SUCCESS",
        title:
          body.status === "APPROVED"
            ? `${access!.name} duyệt proposal: ${updated.section}`
            : `${access!.name} từ chối proposal: ${updated.section}`,
        details: updated.requestedChange,
        actorName: access!.name,
        actorEmail: access!.email,
        actorRole: "Leader",
        actionUrl: `/?p=${id}&token=${token}&tab=history`,
        actionLabel: "Xem Proposal",
      });
    } catch { /* non-fatal */ }

    return Response.json({
      proposal: {
        id: updated.id,
        projectId: updated.projectId,
        memberId: updated.memberId,
        memberName: updated.member?.name || null,
        section: updated.section,
        requestedChange: updated.requestedChange,
        status: updated.status,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to update edit proposal", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
