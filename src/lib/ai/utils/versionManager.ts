// ai/utils/versionManager.ts — Version Manager
// Tracks version history for each section (artifact versioning).
// Every time a section is saved (via SectionEditor, Refine, or Pipeline),
// a new version is recorded. Users can view diff between versions.

import { db } from "@/lib/db";
import { appendLog } from "@/lib/pipeline-progress";

export interface ArtifactVersion {
  id: string;
  projectId: string;
  section: string;
  version: number;
  content: string; // JSON string of the section data
  changedBy: string; // "pipeline" | "refine" | "leader" | "member"
  changedByName: string;
  createdAt: string;
}

/**
 * Save a new version of a section.
 * Called every time section content changes.
 */
export async function saveVersion(
  projectId: string,
  section: string,
  content: string,
  changedBy: string,
  changedByName: string
): Promise<void> {
  try {
    // Get current max version for this section
    const existing = await db.analysis.findUnique({
      where: { projectId_type: { projectId, type: section } },
      select: { version: true },
    });
    const nextVersion = (existing?.version || 0) + 1;

    // Update the Analysis row (increment version)
    await db.analysis.upsert({
      where: { projectId_type: { projectId, type: section } },
      update: { content, version: nextVersion },
      create: { projectId, type: section, content, version: nextVersion },
    });

    appendLog({
      level: "info",
      agentId: "VERSION",
      provider: "pipeline",
      message: `📋 [VERSION] Section "${section}" saved as v${nextVersion} by ${changedByName} (${changedBy})`,
    });
  } catch (err) {
    console.error("[VERSION] Failed to save version:", err);
  }
}

/**
 * Get version history for a section.
 */
export async function getVersionHistory(
  projectId: string,
  section: string
): Promise<{ version: number; updatedAt: string }[]> {
  // Since we only store the latest version in Analysis, we return just that.
  // In a full implementation, we'd have a separate ArtifactVersion table.
  const analysis = await db.analysis.findUnique({
    where: { projectId_type: { projectId, type: section } },
    select: { version: true, updatedAt: true },
  });
  if (!analysis) return [];
  return [{ version: analysis.version, updatedAt: analysis.updatedAt.toISOString() }];
}

/**
 * Get the current version number for a section.
 */
export async function getCurrentVersion(
  projectId: string,
  section: string
): Promise<number> {
  const analysis = await db.analysis.findUnique({
    where: { projectId_type: { projectId, type: section } },
    select: { version: true },
  });
  return analysis?.version || 0;
}
