// NEXUS AI - Access control helpers
// Resolves who is visiting a project: leader (full edit) or member (view + chat).

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import type { AccessInfo } from "./types";

export async function resolveAccess(
  projectId: string,
  token?: string | null
): Promise<AccessInfo | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  });
  if (!project) return null;

  // Leader token
  if (token && token === project.leaderToken) {
    return {
      role: "leader",
      projectId,
      name: project.leaderName,
      email: project.leaderEmail,
    };
  }

  // Member token
  if (token) {
    const member = project.members.find((m) => m.inviteToken === token);
    if (member) {
      // mark joined
      if (!member.joinedAt) {
        await db.member.update({
          where: { id: member.id },
          data: { joinedAt: new Date() },
        });
        // Log member-joined activity (fire-and-forget; safe if it fails)
        try {
          await logActivity({
            projectId,
            type: "MEMBER_JOINED",
            status: "SUCCESS",
            title: `${member.name} tham gia dự án`,
            details: `${member.email} vừa xác nhận lời mời và tham gia workspace.`,
            actorName: member.name,
            actorEmail: member.email,
            actorRole: "Member",
            actionUrl: `/?p=${projectId}&token=${token}&tab=members`,
            actionLabel: "Mở dự án",
          });
        } catch { /* non-fatal */ }
      }
      return {
        role: "member",
        projectId,
        memberId: member.id,
        name: member.name,
        email: member.email,
      };
    }
  }

  // No token: only allowed if project is in DRAFT/ANALYZING (leader creating it)
  // For safety, treat as leader only when token matches; otherwise deny.
  return null;
}

export function requireLeader(access: AccessInfo | null): boolean {
  return access?.role === "leader";
}
