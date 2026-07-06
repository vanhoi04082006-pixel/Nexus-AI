// NEXUS AI - Zod schemas for all 9 agent sections
// Lenient schemas that accept common AI output variations.
// Uses preprocessors to coerce array↔string before validation.

import { z } from "zod";

/* ===========================================================
   Preprocessors — coerce common AI mistakes before Zod validates
=========================================================== */

// Accept both string and array → return string (join with ", ")
const toString = z.preprocess((v) => {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}, z.string());

// Accept both string and array → return array (split by comma/newline)
const toStringArray = z.preprocess((v) => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) return v.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  return [];
}, z.array(z.string()));

// Accept string/number → number
const toNumber = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (!isNaN(n)) return n;
  }
  return 0;
}, z.number());

/* ===========================================================
   01 - Requirement Analyst
=========================================================== */
export const analysisSchema = z.object({
  desc: z.string().min(5),
  techStack: z.object({
    frontend: z.object({ name: toString, ver: toString, reason: toString }),
    backend: z.object({ name: toString, ver: toString, reason: toString }),
    database: z.object({ name: toString, ver: toString, reason: toString }),
    cache: z.object({ name: toString, ver: toString, reason: toString }),
    tools: toStringArray,
  }),
  teamSize: toNumber,
  estimatedDuration: toString,
  complexity: toString,
  features: z.array(z.object({
    name: toString,
    module: toString,
    pri: toString,
  })).min(1),
  actors: z.array(z.object({
    name: toString,
    desc: toString,
  })).min(1),
  modules: toStringArray,
});

/* ===========================================================
   02 - HR Planner
=========================================================== */
export const hrSchema = z.object({
  assignments: z.array(z.object({
    name: toString,
    role: toString,
    reason: toString,
    modules: toStringArray,
    workload: toNumber,
    strengths: toString,
    weaknesses: toString,
  })).min(1),
  coverage: toString.default(""),
  risks: z.array(z.object({
    risk: toString,
    mitigation: toString,
  })).default([]),
});

/* ===========================================================
   03 - Sprint Planner
=========================================================== */
export const sprintSchema = z.object({
  totalSprints: toNumber,
  sprintDuration: toString,
  sprints: z.array(z.object({
    name: toString,
    start: toString,
    end: toString,
    goals: toStringArray,
    tasks: z.array(z.object({
      task: toString,
      assignee: toString,
      hours: toNumber,
      status: toString,
    })).default([]),
    color: toString.default(""),
  })).min(1),
  milestones: z.array(z.object({
    date: toString,
    event: toString,
  })).default([]),
});

/* ===========================================================
   04 - System Architect
=========================================================== */
export const designSchema = z.object({
  architectureDesc: z.string().min(5),
  dbTables: z.array(z.object({
    name: toString,
    columns: toStringArray,
    relations: toStringArray,
  })).min(1),
  apiEndpoints: z.array(z.object({
    method: toString,
    path: toString,
    desc: toString,
  })).min(1),
  folderStructure: z.string().min(5),
});

/* ===========================================================
   05 - UML Generator
=========================================================== */
export const umlSchema = z.object({
  useCase: toString,
  classDiagram: toString,
  erd: toString,
  sequence: toString,
});

/* ===========================================================
   06 - Technical Writer
=========================================================== */
export const docsSchema = z.object({
  readme: z.string().min(10),
  convention: z.string().min(10),
  apiStandard: z.string().min(10),
});

/* ===========================================================
   07 - Git / DevOps
=========================================================== */
export const gitSchema = z.object({
  gitCommands: toString,
  branchStrategy: toString,
  issueTemplate: toString,
  repoUrl: toString,
});

/* ===========================================================
   08 - Software Tester
=========================================================== */
export const testSchema = z.object({
  testStrategy: z.string().min(5),
  unitTests: z.array(z.object({
    module: toString,
    cases: z.array(z.object({
      name: toString,
      desc: toString,
      input: toString,
      expected: toString,
    })).default([]),
  })).min(1),
  integrationTests: z.array(z.object({
    name: toString,
    desc: toString,
    flow: toString,
  })).default([]),
  e2eTests: z.array(z.object({
    name: toString,
    desc: toString,
    steps: toStringArray,
  })).default([]),
  apiTests: z.array(z.object({
    endpoint: toString,
    method: toString,
    cases: toString,
  })).default([]),
  performanceTests: z.array(z.object({
    scenario: toString,
    metric: toString,
    target: toString,
  })).default([]),
  bugReportTemplate: toString.default(""),
});

/* ===========================================================
   09 - Security Reviewer
=========================================================== */
export const securitySchema = z.object({
  threats: z.array(z.object({
    risk: toString,
    severity: toString,
    mitigation: toString,
  })).min(1),
  authFlow: z.string().min(5),
  authzModel: toString.default(""),
  dataProtection: toString.default(""),
  owaspChecklist: z.array(z.object({
    category: toString,
    status: toString,
    note: toString,
  })).default([]),
  rateLimit: toString.default(""),
  secrets: toString.default(""),
});

/* ===========================================================
   Schema Registry
=========================================================== */
export const SCHEMAS: Record<string, z.ZodSchema> = {
  analysis: analysisSchema,
  hr: hrSchema,
  sprint: sprintSchema,
  design: designSchema,
  uml: umlSchema,
  docs: docsSchema,
  git: gitSchema,
  test: testSchema,
  security: securitySchema,
};

/**
 * Validate data against the schema for a given section type.
 * Returns { success: true, data } or { success: false, error }.
 * On failure, the error message can be fed back to the AI for self-fix.
 */
export function validateSection(
  section: string,
  data: unknown
): { success: true; data: unknown } | { success: false; error: string } {
  const schema = SCHEMAS[section];
  if (!schema) {
    // No schema defined → accept anything (backward compat)
    return { success: true, data };
  }
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  // Format Zod errors into readable message for AI self-fix
  const errorMessages = result.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `Field "${path}": ${issue.message}`;
    })
    .join("; ");
  return { success: false, error: errorMessages };
}
