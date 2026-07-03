// NEXUS AI - Zod schemas for all 9 agent sections
// Replaces heuristic JFix parsing with strict runtime validation.
// If AI output doesn't match schema → Zod throws → callAndParse retries.

import { z } from "zod";

/* ===========================================================
   01 - Requirement Analyst
=========================================================== */
export const analysisSchema = z.object({
  desc: z.string().min(10),
  techStack: z.object({
    frontend: z.object({ name: z.string(), ver: z.string(), reason: z.string() }),
    backend: z.object({ name: z.string(), ver: z.string(), reason: z.string() }),
    database: z.object({ name: z.string(), ver: z.string(), reason: z.string() }),
    cache: z.object({ name: z.string(), ver: z.string(), reason: z.string() }),
    tools: z.array(z.string()),
  }),
  teamSize: z.number(),
  estimatedDuration: z.string(),
  complexity: z.string(),
  features: z.array(z.object({
    name: z.string(),
    module: z.string(),
    pri: z.string(),
  })).min(3),
  actors: z.array(z.object({
    name: z.string(),
    desc: z.string(),
  })).min(2),
  modules: z.array(z.string()).min(3),
});

/* ===========================================================
   02 - HR Planner
=========================================================== */
export const hrSchema = z.object({
  assignments: z.array(z.object({
    name: z.string(),
    role: z.string(),
    reason: z.string(),
    modules: z.array(z.string()),
    workload: z.number(),
    strengths: z.string(),
    weaknesses: z.string(),
  })).min(1),
  coverage: z.string(),
  risks: z.array(z.object({
    risk: z.string(),
    mitigation: z.string(),
  })),
});

/* ===========================================================
   03 - Sprint Planner
=========================================================== */
export const sprintSchema = z.object({
  totalSprints: z.number(),
  sprintDuration: z.string(),
  sprints: z.array(z.object({
    name: z.string(),
    start: z.string(),
    end: z.string(),
    goals: z.array(z.string()),
    tasks: z.array(z.object({
      task: z.string(),
      assignee: z.string(),
      hours: z.number(),
      status: z.string(),
    })),
    color: z.string(),
  })).min(1),
  milestones: z.array(z.object({
    date: z.string(),
    event: z.string(),
  })),
});

/* ===========================================================
   04 - System Architect
=========================================================== */
export const designSchema = z.object({
  architectureDesc: z.string().min(10),
  dbTables: z.array(z.object({
    name: z.string(),
    columns: z.array(z.string()),
    relations: z.array(z.string()),
  })).min(3),
  apiEndpoints: z.array(z.object({
    method: z.string(),
    path: z.string(),
    desc: z.string(),
  })).min(3),
  folderStructure: z.string().min(10),
});

/* ===========================================================
   05 - UML Generator
=========================================================== */
export const umlSchema = z.object({
  useCase: z.string(),
  classDiagram: z.string(),
  erd: z.string(),
  sequence: z.string(),
});

/* ===========================================================
   06 - Technical Writer
=========================================================== */
export const docsSchema = z.object({
  readme: z.string().min(50),
  convention: z.string().min(50),
  apiStandard: z.string().min(50),
});

/* ===========================================================
   07 - Git / DevOps
=========================================================== */
export const gitSchema = z.object({
  gitCommands: z.string(),
  branchStrategy: z.string(),
  issueTemplate: z.string(),
  repoUrl: z.string(),
});

/* ===========================================================
   08 - Software Tester
=========================================================== */
export const testSchema = z.object({
  testStrategy: z.string().min(10),
  unitTests: z.array(z.object({
    module: z.string(),
    cases: z.array(z.object({
      name: z.string(),
      desc: z.string(),
      input: z.string(),
      expected: z.string(),
    })),
  })).min(1),
  integrationTests: z.array(z.object({
    name: z.string(),
    desc: z.string(),
    flow: z.string(),
  })),
  e2eTests: z.array(z.object({
    name: z.string(),
    desc: z.string(),
    steps: z.array(z.string()),
  })),
  apiTests: z.array(z.object({
    endpoint: z.string(),
    method: z.string(),
    cases: z.string(),
  })),
  performanceTests: z.array(z.object({
    scenario: z.string(),
    metric: z.string(),
    target: z.string(),
  })),
  bugReportTemplate: z.string(),
});

/* ===========================================================
   09 - Security Reviewer
=========================================================== */
export const securitySchema = z.object({
  threats: z.array(z.object({
    risk: z.string(),
    severity: z.string(),
    mitigation: z.string(),
  })).min(1),
  authFlow: z.string().min(10),
  authzModel: z.string(),
  dataProtection: z.string(),
  owaspChecklist: z.array(z.object({
    category: z.string(),
    status: z.string(),
    note: z.string(),
  })),
  rateLimit: z.string(),
  secrets: z.string(),
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
    .map((issue: { path: (string | number)[]; message: string }) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `Field "${path}": ${issue.message}`;
    })
    .join("; ");
  return { success: false, error: errorMessages };
}
