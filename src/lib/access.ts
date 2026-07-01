// NEXUS AI - Access control helpers
// Resolves who is visiting a project: leader (full edit) or member (view + chat).

import { db } from "./db";
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
