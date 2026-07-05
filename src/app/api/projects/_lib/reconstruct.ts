// NEXUS AI - Shared helpers for API routes
// Reconstructs ProjectInput / ProjectResult from DB records.
// Lives under src/app/api/ so we don't touch src/lib/*.

import { db } from "@/lib/db";
import type { ProjectInput, ProjectResult, SectionType } from "@/lib/types";

export const SECTION_KEYS: SectionType[] = [
  "analysis",
  "hr",
  "sprint",
  "design",
  "uml",
  "docs",
  "git",
  "test",
  "security",
];

/**
 * Rebuild the original ProjectInput from a stored Project + Members.
 */
export async function reconstructInput(
  projectId: string
): Promise<ProjectInput | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  });
  if (!project) return null;

  let extra: {
    requirements?: string[] | string;
    specialReqs?: string;
    techPrefs?: string[] | string;
    langPrefs?: string[] | string;
  } = {};
  try {
    extra = JSON.parse(project.extraInfo || "{}");
  } catch {
    extra = {};
  }

  // Helper: accept either string (comma-separated) or array, return string
  const toStr = (v: string[] | string | undefined, sep = ", "): string => {
    if (Array.isArray(v)) return v.join(sep);
    if (typeof v === "string") return v;
    return "";
  };

  return {
    topic: project.topic,
    description: project.description,
    purpose: project.purpose,
    extraInfo: {
      requirements: toStr(extra.requirements, "\n"),
      specialReqs: typeof extra.specialReqs === "string" ? extra.specialReqs : "",
      techPrefs: toStr(extra.techPrefs),
      langPrefs: toStr(extra.langPrefs),
    },
    members: project.members.map((m) => ({
      name: m.name,
      email: m.email,
      strengths: m.strengths,
      weaknesses: m.weaknesses,
    })),
    leaderName: project.leaderName,
    leaderEmail: project.leaderEmail,
    leaderSmtpPassword: project.leaderSmtpPassword || undefined,
  };
}

/**
 * Rebuild the ProjectResult (all 7 sections) from stored Analysis rows.
 * Missing sections are returned as empty objects.
 */
export async function reconstructResult(
  projectId: string
): Promise<ProjectResult> {
  const analyses = await db.analysis.findMany({ where: { projectId } });
  const result: Record<string, unknown> = {};
  for (const a of analyses) {
    try {
      result[a.type] = JSON.parse(a.content);
    } catch {
      result[a.type] = {};
    }
  }
  return result as unknown as ProjectResult;
}

/**
 * Build a JSON-serializable summary of a member safe for any role.
 * Leader-only fields (inviteToken) are added by the caller when appropriate.
 */
export function publicMember(m: {
  id: string;
  name: string;
  email: string;
  strengths: string;
  weaknesses: string;
  role: string;
  joinedAt: Date | null;
  createdAt?: Date;
}) {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    strengths: m.strengths,
    weaknesses: m.weaknesses,
    role: m.role,
    joinedAt: m.joinedAt,
    createdAt: m.createdAt,
  };
}
