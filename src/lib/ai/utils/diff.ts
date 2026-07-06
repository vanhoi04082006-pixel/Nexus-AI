// ai/utils/diff.ts — Change Impact Analyzer
// Detects what changed between two versions of a section and identifies
// which other sections need to be re-generated.

import type { SectionType } from "@/lib/types";

export interface ChangeDiff {
  section: string;
  changed: boolean;
  changes: string[]; // human-readable list of changes
}

export interface ImpactAnalysis {
  changedSections: string[];
  impactedSections: string[]; // sections that depend on changed ones
  severity: "low" | "medium" | "high";
  recommendation: string;
}

// Dependency graph: which sections depend on which
const SECTION_DEPENDENCIES: Record<string, string[]> = {
  analysis: [],
  hr: ["analysis"],
  sprint: ["analysis", "hr"],
  design: ["analysis"],
  uml: ["design"],
  docs: ["design"],
  git: ["analysis"],
  test: ["design"],
  security: ["design"],
};

/**
 * Compare two objects and identify what changed.
 */
export function diffSections(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): ChangeDiff[] {
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const diffs: ChangeDiff[] = [];

  for (const key of allKeys) {
    const oldVal = oldData[key];
    const newVal = newData[key];
    const oldStr = JSON.stringify(oldVal);
    const newStr = JSON.stringify(newVal);

    if (oldStr === newStr) {
      diffs.push({ section: key, changed: false, changes: [] });
    } else {
      const changes: string[] = [];

      // Detect specific changes
      if (!oldVal && newVal) {
        changes.push(`Added new section "${key}"`);
      } else if (oldVal && !newVal) {
        changes.push(`Removed section "${key}"`);
      } else if (typeof oldVal === "object" && typeof newVal === "object") {
        const oldObj = oldVal as Record<string, unknown>;
        const newObj = newVal as Record<string, unknown>;
        const subKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
        for (const sk of subKeys) {
          if (JSON.stringify(oldObj[sk]) !== JSON.stringify(newObj[sk])) {
            changes.push(`Field "${sk}" changed`);
          }
        }
      } else {
        changes.push(`Value changed from "${(oldStr || "").substring(0, 50)}" to "${(newStr || "").substring(0, 50)}"`);
      }

      diffs.push({ section: key, changed: true, changes });
    }
  }

  return diffs;
}

/**
 * Analyze the impact of changes across sections.
 * If section X changes, all sections that depend on X need re-generation.
 */
export function analyzeImpact(changedSections: string[]): ImpactAnalysis {
  const impacted = new Set<string>();

  // Find all sections that transitively depend on changed sections
  function findImpacted(section: string) {
    for (const [dependent, deps] of Object.entries(SECTION_DEPENDENCIES)) {
      if (deps.includes(section) && !impacted.has(dependent)) {
        impacted.add(dependent);
        findImpacted(dependent); // recursive — dependents of dependents
      }
    }
  }

  for (const section of changedSections) {
    findImpacted(section);
  }

  // Determine severity
  const totalImpacted = impacted.size + changedSections.length;
  let severity: "low" | "medium" | "high" = "low";
  if (changedSections.includes("analysis")) {
    severity = "high"; // analysis is the root — everything depends on it
  } else if (changedSections.includes("design")) {
    severity = "high"; // design feeds uml, docs, test, security
  } else if (totalImpacted > 3) {
    severity = "medium";
  }

  const recommendation =
    severity === "high"
      ? "Re-run full pipeline — root sections changed"
      : severity === "medium"
      ? `Re-run ${impacted.size + changedSections.length} affected sections: ${[...changedSections, ...impacted].join(", ")}`
      : `Minor changes — only re-run: ${changedSections.join(", ")}`;

  return {
    changedSections,
    impactedSections: Array.from(impacted),
    severity,
    recommendation,
  };
}
