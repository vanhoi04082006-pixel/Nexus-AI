// ai/pipeline/reflection.ts — Reflection Agent
// After an agent completes, the Reflection Agent reviews its output
// for common quality issues before the pipeline accepts it.

import { appendLog } from "@/lib/pipeline-progress";
import type { SectionType } from "@/lib/types";

export interface ReflectionResult {
  passed: boolean;
  issues: string[];
  suggestions: string[];
  score: number; // 0-100
}

/**
 * Reflection Agent — reviews agent output for quality issues.
 * Uses rule-based checks (no LLM call needed — fast + free).
 */
export function reflect(section: string, data: unknown): ReflectionResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  if (!data || typeof data !== "object") {
    return { passed: false, issues: ["Output is not an object"], suggestions: ["Re-run agent"], score: 0 };
  }

  const obj = data as Record<string, unknown>;
  const dataStr = JSON.stringify(data);

  // Check 1: Empty content
  if (dataStr.length < 50) {
    issues.push("Output is too short (< 50 chars)");
    score -= 30;
  }

  // Check 2: Empty arrays
  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val) && val.length === 0) {
      issues.push(`Field "${key}" is an empty array`);
      score -= 10;
    }
  }

  // Check 3: Empty strings
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string" && val.trim().length === 0) {
      issues.push(`Field "${key}" is an empty string`);
      score -= 10;
    }
  }

  // Check 4: Section-specific checks
  switch (section) {
    case "analysis":
      if (!obj.features || (obj.features as unknown[]).length < 5) {
        issues.push("Analysis should have at least 5 features");
        suggestions.push("Add more features to cover all modules");
        score -= 15;
      }
      if (!obj.actors || (obj.actors as unknown[]).length < 2) {
        issues.push("Analysis should have at least 2 actors");
        score -= 10;
      }
      if (!obj.modules || (obj.modules as string[]).length < 3) {
        issues.push("Analysis should have at least 3 modules");
        score -= 10;
      }
      break;

    case "hr":
      if (!obj.assignments || (obj.assignments as unknown[]).length === 0) {
        issues.push("HR should have at least 1 assignment");
        score -= 25;
      }
      break;

    case "design":
      if (!obj.dbTables || (obj.dbTables as unknown[]).length < 3) {
        issues.push("Design should have at least 3 DB tables");
        suggestions.push("Add more tables to cover all modules");
        score -= 15;
      }
      if (!obj.apiEndpoints || (obj.apiEndpoints as unknown[]).length < 3) {
        issues.push("Design should have at least 3 API endpoints");
        score -= 10;
      }
      break;

    case "uml":
      const uml = obj as { useCase?: string; classDiagram?: string; erd?: string; sequence?: string };
      if (!uml.useCase || uml.useCase.length < 50) { issues.push("Use Case diagram is missing or too short"); score -= 15; }
      if (!uml.classDiagram || uml.classDiagram.length < 50) { issues.push("Class diagram is missing or too short"); score -= 15; }
      if (!uml.erd || uml.erd.length < 50) { issues.push("ERD is missing or too short"); score -= 15; }
      if (!uml.sequence || uml.sequence.length < 50) { issues.push("Sequence diagram is missing or too short"); score -= 15; }
      break;

    case "docs":
      const docs = obj as { readme?: string; convention?: string; apiStandard?: string };
      if (!docs.readme || docs.readme.length < 200) { issues.push("README is too short (< 200 chars)"); score -= 15; }
      if (!docs.convention || docs.convention.length < 100) { issues.push("Convention is too short"); score -= 10; }
      break;

    case "security":
      if (!obj.threats || (obj.threats as unknown[]).length < 3) {
        issues.push("Security should have at least 3 threats");
        score -= 15;
      }
      break;
  }

  // Check 5: Generic names (User, Course, Student) when project is domain-specific
  const genericNames = ['"User"', '"Course"', '"Student"', '"Item"', '"Entity"'];
  const genericFound = genericNames.some((name) => dataStr.includes(name) && dataStr.includes('"name"'));
  if (genericFound && section === "analysis") {
    suggestions.push("Consider using domain-specific entity names instead of generic (User, Course, etc.)");
    score -= 5;
  }

  const passed = score >= 60 && issues.length === 0;

  if (issues.length > 0) {
    appendLog({
      level: "warn",
      agentId: "REFLECTION",
      provider: "pipeline",
      message: `🔍 [REFLECTION] Section "${section}" — score: ${score}/100, ${issues.length} issue(s): ${issues.slice(0, 3).join("; ")}`,
    });
  } else {
    appendLog({
      level: "success",
      agentId: "REFLECTION",
      provider: "pipeline",
      message: `🔍 [REFLECTION] Section "${section}" — score: ${score}/100 ✓ PASSED`,
    });
  }

  return { passed, issues, suggestions, score: Math.max(0, score) };
}
