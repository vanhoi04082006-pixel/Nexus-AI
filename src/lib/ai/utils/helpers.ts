// ai/utils/helpers.ts — Utility functions for the AI pipeline

import type { ProjectResult, ProjectInput, SectionType } from "@/lib/types";
import { compressContext, JSON_INSTRUCTION, FEW_SHOT_NOTE } from "../config/constants";

export function isValidSchema(d: unknown, k: SectionType): boolean {
  if (!d || typeof d !== "object") return false;
  const MIN_KEYS: Record<SectionType, string[]> = {
    analysis: ["desc", "techStack", "features", "actors", "modules"],
    hr: ["assignments"],
    sprint: ["sprints"],
    design: ["dbTables", "apiEndpoints", "folderStructure"],
    uml: ["useCase", "classDiagram", "erd", "sequence"],
    docs: ["readme", "convention", "apiStandard"],
    git: ["gitCommands", "branchStrategy", "issueTemplate", "repoUrl"],
    test: ["testStrategy", "unitTests"],
    security: ["threats", "authFlow"],
  };
  // FIX: Reject unknown section keys (was returning true → garbage keys polluted merge)
  const required = MIN_KEYS[k];
  if (!required) return false; // unknown section → reject
  const obj = d as Record<string, unknown>;
  return required.every((key) => key in obj);
}

/** Set of valid section keys — used to filter reviewer output */
export const VALID_SECTION_KEYS: Set<SectionType> = new Set([
  "analysis", "hr", "sprint", "design", "uml", "docs", "git", "test", "security",
]);

export function isEmptyObj(o: unknown): boolean {
  if (!o || typeof o !== "object") return true;
  return Object.keys(o).length === 0;
}

export { compressContext, JSON_INSTRUCTION, FEW_SHOT_NOTE };

/**
 * Build context string for an agent based on its section key.
 * Includes project topic, description, member info, and relevant
 * cross-section data that the agent needs to synchronize with.
 */
export function buildCtx(
  key: SectionType,
  results: Partial<ProjectResult>,
  input: ProjectInput
): string {
  const members = input.members;
  const ms = members
    .map((m, i) => `${i + 1}. ${m.name} | Uu: ${m.strengths} | Nhuoc: ${m.weaknesses}`)
    .join("\n");

  // Defensive: handle both string and array for requirements/techPrefs/langPrefs
  const toArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map((x) => String(x));
    if (typeof v === "string" && v.trim()) return v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    return [];
  };
  const requirementsStr = toArray(input.extraInfo.requirements).join("; ");
  const techPrefsStr = toArray(input.extraInfo.techPrefs).join(", ");
  const langPrefsStr = toArray(input.extraInfo.langPrefs).join(", ");

  let c = `Du an: ${input.topic}`;
  if (input.description) c += `\nMo ta: ${input.description}`;
  if (input.purpose) c += `\nMuc dich: ${input.purpose}`;
  if (requirementsStr) c += `\nChuc nang yeu cau: ${requirementsStr}`;
  if (input.extraInfo.specialReqs) c += `\nYeu cau dac biet: ${input.extraInfo.specialReqs}`;
  if (techPrefsStr) c += `\nCong nghe: ${techPrefsStr}`;
  if (langPrefsStr) c += `\nNgon ngu: ${langPrefsStr}`;
  c += `\nThanh vien (${members.length}):\n${ms}`;

  switch (key) {
    case "hr":
      c += `\n\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      c += `\nFeatures: ${JSON.stringify((results.analysis?.features || []).map((f) => f.name))}`;
      break;
    case "sprint":
      c += `\n\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      c += `\nFeatures: ${JSON.stringify((results.analysis?.features || []).map((f) => f.name))}`;
      c += `\nTeam: ${JSON.stringify(results.hr?.assignments?.map((a) => ({ name: a.name, role: a.role, modules: a.modules })) || [])}`;
      break;
    case "design":
      c += `\n\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      c += `\nFeatures: ${JSON.stringify((results.analysis?.features || []).map((f) => f.name))}`;
      c += `\nActors: ${JSON.stringify((results.analysis?.actors || []).map((a) => a.name))}`;
      c += `\nTeam: ${JSON.stringify(results.hr?.assignments?.map((a) => ({ name: a.name, role: a.role, modules: a.modules })) || [])}`;
      break;
    case "uml":
      // SMART CONTEXT: UML split agents need full data for accurate diagrams
      c += `\n\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      c += `\nFeatures: ${JSON.stringify((results.analysis?.features || []).map((f) => f.name))}`;
      c += `\nActors: ${JSON.stringify(results.analysis?.actors || [])}`;
      c += `\nDB Tables (full): ${JSON.stringify(results.design?.dbTables || [])}`;
      c += `\nAPI endpoints: ${JSON.stringify(results.design?.apiEndpoints || [])}`;
      c += `\nTech Stack: ${JSON.stringify(results.analysis?.techStack)}`;
      break;
    case "docs":
      // SMART CONTEXT: Docs need full context for rich content
      c += `\n\nTech: ${JSON.stringify(results.analysis?.techStack)}`;
      c += `\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      c += `\nFeatures: ${JSON.stringify((results.analysis?.features || []).map((f) => f.name))}`;
      c += `\nActors: ${JSON.stringify((results.analysis?.actors || []).map((a) => a.name))}`;
      c += `\nFolder Structure: ${results.design?.folderStructure || "N/A"}`;
      c += `\nAPI endpoints: ${JSON.stringify((results.design?.apiEndpoints || []).slice(0, 10))}`;
      c += `\nDB Tables: ${JSON.stringify((results.design?.dbTables || []).slice(0, 5).map((t) => t.name))}`;
      c += `\nTeam: ${JSON.stringify(results.hr?.assignments?.map((a) => ({ name: a.name, role: a.role })) || [])}`;
      break;
    case "git":
      c += `\n\nSlug: ${input.topic.toLowerCase().replace(/\s+/g, "-")}`;
      c += `\nTech: ${JSON.stringify(results.analysis?.techStack)}`;
      c += `\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      break;
    case "test":
      c += `\n\nModules: ${JSON.stringify(results.analysis?.modules || [])}`;
      c += `\nFeatures: ${JSON.stringify((results.analysis?.features || []).map((f) => ({ name: f.name, module: f.module, pri: f.pri })))}`;
      c += `\nAPI endpoints: ${JSON.stringify(results.design?.apiEndpoints || [])}`;
      break;
    case "security":
      c += `\n\nTech: ${JSON.stringify(results.analysis?.techStack)}`;
      c += `\nAPI: ${JSON.stringify((results.design?.apiEndpoints || []).slice(0, 10))}`;
      c += `\nDB: ${JSON.stringify((results.design?.dbTables || []).slice(0, 5).map((t) => t.name))}`;
      break;
  }
  return c;
}

/**
 * Build a review summary for the Quality Reviewer agent.
 */
export function buildReviewSummary(results: ProjectResult, topic: string): string {
  const sections = {
    analysis: {
      hasDesc: !!results.analysis?.desc,
      featuresCount: results.analysis?.features?.length || 0,
      actorsCount: results.analysis?.actors?.length || 0,
      modulesCount: results.analysis?.modules?.length || 0,
    },
    hr: {
      hasAssignments: !!results.hr?.assignments,
      assignmentsCount: results.hr?.assignments?.length || 0,
      hasRisks: (results.hr?.risks?.length || 0) > 0,
    },
    sprint: {
      sprintsCount: results.sprint?.sprints?.length || 0,
      milestonesCount: results.sprint?.milestones?.length || 0,
    },
    design: {
      dbTablesCount: results.design?.dbTables?.length || 0,
      apiEndpointsCount: results.design?.apiEndpoints?.length || 0,
      hasFolderStructure: !!results.design?.folderStructure,
    },
    uml: {
      hasUseCase: !!results.uml?.useCase,
      hasClassDiagram: !!results.uml?.classDiagram,
      hasErd: !!results.uml?.erd,
      hasSequence: !!results.uml?.sequence,
    },
    docs: {
      hasReadme: !!results.docs?.readme,
      hasConvention: !!results.docs?.convention,
      hasApiStandard: !!results.docs?.apiStandard,
    },
    git: {
      hasGitCommands: !!results.git?.gitCommands,
      hasBranchStrategy: !!results.git?.branchStrategy,
    },
    test: {
      hasTestStrategy: !!results.test?.testStrategy,
      unitTestsCount: results.test?.unitTests?.length || 0,
    },
    security: {
      threatsCount: results.security?.threats?.length || 0,
      hasAuthFlow: !!results.security?.authFlow,
    },
  };
  return `Du an: ${topic}\n\nTong hop ket qua:\n${JSON.stringify(sections, null, 2)}`;
}
