// ai/utils/dependencyAnalyzer.ts — Dependency Analyzer
// Analyzes entity dependencies within and across sections.
// Detects: orphan entities, missing relations, circular dependencies.

import type { ProjectResult } from "@/lib/types";

export interface DependencyReport {
  orphans: string[];           // entities with no relations
  missingRelations: string[];  // expected relations that don't exist
  circular: string[];          // circular dependency chains
  coverage: number;            // % of entities that are connected
  report: string;              // human-readable report
}

/**
 * Analyze entity dependencies across all sections.
 */
export function analyzeDependencies(results: Partial<ProjectResult>): DependencyReport {
  const orphans: string[] = [];
  const missingRelations: string[] = [];
  const circular: string[] = [];

  // Collect all entities from all sections
  const entities = new Set<string>();
  const relations: { from: string; to: string; source: string }[] = [];

  // From analysis: modules + features
  if (results.analysis) {
    const a = results.analysis;
    a.modules?.forEach((m) => entities.add(m));
    a.features?.forEach((f) => entities.add(f.name));
    a.actors?.forEach((actor) => entities.add(actor.name));
  }

  // From design: DB tables + relations
  if (results.design) {
    const d = results.design;
    d.dbTables?.forEach((t) => {
      entities.add(t.name);
      t.relations?.forEach((rel) => {
        // Parse relation string: "User has many Orders" → from=User, to=Orders
        const parts = rel.match(/(\w+).*?(\w+)/);
        if (parts) {
          relations.push({ from: parts[1], to: parts[2], source: "design.dbTables" });
        }
      });
    });
  }

  // From HR: assignments → modules
  if (results.hr) {
    results.hr.assignments?.forEach((a) => {
      entities.add(a.name);
      a.modules?.forEach((m) => {
        relations.push({ from: a.name, to: m, source: "hr.assignments" });
      });
    });
  }

  // From UML: class diagram entities (parse class names)
  if (results.uml?.classDiagram) {
    const classMatches = results.uml.classDiagram.matchAll(/class\s+(\w+)/g);
    for (const match of classMatches) {
      entities.add(match[1]);
    }
  }

  // Find orphans: entities with no relations
  const connectedEntities = new Set<string>();
  for (const rel of relations) {
    connectedEntities.add(rel.from);
    connectedEntities.add(rel.to);
  }
  for (const entity of entities) {
    if (!connectedEntities.has(entity)) {
      orphans.push(entity);
    }
  }

  // Check for missing relations: DB tables that should relate to modules
  if (results.design?.dbTables && results.analysis?.modules) {
    const tableNames = results.design.dbTables.map((t) => t.name.toLowerCase());
    for (const mod of results.analysis.modules) {
      const modLower = mod.toLowerCase();
      const hasTable = tableNames.some((t) => t.includes(modLower) || modLower.includes(t));
      if (!hasTable) {
        missingRelations.push(`Module "${mod}" has no corresponding DB table`);
      }
    }
  }

  // Simple circular dependency check (depth 2)
  for (const r1 of relations) {
    for (const r2 of relations) {
      if (r1.from === r2.to && r1.to === r2.from) {
        const cycle = `${r1.from} ↔ ${r1.to}`;
        if (!circular.includes(cycle)) circular.push(cycle);
      }
    }
  }

  const totalEntities = entities.size;
  const connectedCount = connectedEntities.size;
  const coverage = totalEntities > 0 ? Math.round((connectedCount / totalEntities) * 100) : 0;

  const report = [
    `Dependency Analysis Report`,
    `  Total entities: ${totalEntities}`,
    `  Connected: ${connectedCount} (${coverage}%)`,
    `  Orphans: ${orphans.length}`,
    `  Missing relations: ${missingRelations.length}`,
    `  Circular: ${circular.length}`,
    orphans.length > 0 ? `  Orphan entities: ${orphans.slice(0, 5).join(", ")}` : "",
    missingRelations.length > 0 ? `  Missing: ${missingRelations.slice(0, 3).join("; ")}` : "",
    circular.length > 0 ? `  Circular: ${circular.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  return { orphans, missingRelations, circular, coverage, report };
}

/**
 * Artifact Reviewer — reviews section output quality.
 * Checks: markdown formatting, JSON validity, Mermaid syntax, API spec completeness.
 */
export function reviewArtifact(section: string, content: string): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!content || content.trim().length === 0) {
    return { passed: false, issues: ["Empty content"] };
  }

  // Markdown checks (for docs, readme)
  if (section === "docs" || section === "readme") {
    if (!content.includes("#")) issues.push("No markdown headers found");
    if (!content.includes("```")) issues.push("No code blocks found");
    if (content.length < 200) issues.push("Content too short (< 200 chars)");
  }

  // Mermaid checks (for UML)
  if (section === "uml" || section === "useCase" || section === "classDiagram" || section === "erd" || section === "sequence") {
    if (!content.includes("graph") && !content.includes("classDiagram") && !content.includes("erDiagram") && !content.includes("sequenceDiagram")) {
      issues.push("No valid Mermaid diagram declaration found");
    }
    // Check for common syntax errors
    if (content.includes("|use|")) issues.push("Found |use| syntax — should be 'A --> B : use' in classDiagram");
    if (content.match(/[^\x00-\x7F].*\[/)) issues.push("Non-ASCII characters in node ID — sanitize to ASCII");
  }

  // JSON checks (for analysis, hr, sprint, design)
  if (["analysis", "hr", "sprint", "design", "test", "security"].includes(section)) {
    try {
      JSON.parse(content);
    } catch {
      // content might be an object, not a string
      if (typeof content === "string") {
        issues.push("Invalid JSON");
      }
    }
  }

  // API spec checks
  if (section === "design") {
    if (!content.includes("GET") && !content.includes("POST") && !content.includes("PUT") && !content.includes("DELETE")) {
      issues.push("No HTTP methods found in API design");
    }
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Prompt Optimizer — reduces prompt length to save tokens.
 * Removes redundant whitespace, comments, and unnecessary examples.
 */
export function optimizePrompt(prompt: string): string {
  let optimized = prompt;

  // Remove excessive whitespace (3+ newlines → 2)
  optimized = optimized.replace(/\n{3,}/g, "\n\n");

  // Remove trailing whitespace on each line
  optimized = optimized.replace(/[ \t]+$/gm, "");

  // Remove leading whitespace on each line (keep indentation but trim excess)
  optimized = optimized.replace(/^ {4,}/gm, "  ");

  // Remove duplicate lines
  const lines = optimized.split("\n");
  const seen = new Set<string>();
  const deduped = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return true; // keep empty lines for formatting
    if (seen.has(trimmed)) return false;
    seen.add(trimmed);
    return true;
  });
  optimized = deduped.join("\n");

  // Limit to 8000 chars (most models have 8k-32k context)
  if (optimized.length > 8000) {
    optimized = optimized.substring(0, 7900) + "\n...[TRUNCATED]";
  }

  return optimized;
}
