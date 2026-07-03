// NEXUS AI - Shared TypeScript types

export interface MemberInput {
  name: string;
  email: string;
  strengths: string;
  weaknesses: string;
}

export interface ProjectInput {
  topic: string;
  description: string;
  purpose: string;
  extraInfo: {
    requirements: string[];
    specialReqs: string;
    techPrefs: string[];
    langPrefs: string[];
  };
  members: MemberInput[];
  leaderName: string;
  leaderEmail: string;
  leaderSmtpPassword?: string; // Gmail app password for SMTP
  parallel?: boolean; // true = run agents in parallel (fast but more 429s), false = sequential (slow but stable)
}

export type SectionType =
  | "analysis"
  | "hr"
  | "sprint"
  | "design"
  | "uml"
  | "docs"
  | "git"
  | "test"
  | "security";

// ===== Analysis section =====
export interface TechStackItem {
  name: string;
  ver: string;
  reason: string;
}
export interface AnalysisData {
  desc: string;
  techStack: {
    frontend: TechStackItem;
    backend: TechStackItem;
    database: TechStackItem;
    cache: TechStackItem;
    tools: string[];
  };
  teamSize: number;
  estimatedDuration: string;
  complexity: string;
  features: { name: string; module: string; pri: string }[];
  actors: { name: string; desc: string }[];
  modules: string[];
}

// ===== HR section =====
export interface HRData {
  assignments: {
    name: string;
    role: string;
    reason: string;
    modules: string[];
    workload: number;
    strengths: string;
    weaknesses: string;
  }[];
  coverage: string;
  risks: { risk: string; mitigation: string }[];
}

// ===== Sprint section =====
export interface SprintData {
  totalSprints: number;
  sprintDuration: string;
  sprints: {
    name: string;
    start: string;
    end: string;
    goals: string[];
    tasks: { task: string; assignee: string; hours: number; status: string }[];
    color: string;
  }[];
  milestones: { date: string; event: string }[];
}

// ===== Design section =====
export interface DesignData {
  architectureDesc: string;
  dbTables: { name: string; columns: string[]; relations: string[] }[];
  apiEndpoints: { method: string; path: string; desc: string }[];
  folderStructure: string;
}

// ===== UML section =====
export interface UMLData {
  useCase: string;
  classDiagram: string;
  erd: string;
  sequence: string;
}

// ===== Docs section =====
export interface DocsData {
  readme: string;
  convention: string;
  apiStandard: string;
}

// ===== Git section =====
export interface GitData {
  gitCommands: string;
  branchStrategy: string;
  issueTemplate: string;
  repoUrl: string;
}

// ===== Test section (Agent 08 - Software Tester) =====
export interface TestData {
  testStrategy: string;
  unitTests: {
    module: string;
    cases: { name: string; desc: string; input: string; expected: string }[];
  }[];
  integrationTests: { name: string; desc: string; flow: string }[];
  e2eTests: { name: string; desc: string; steps: string[] }[];
  apiTests: { endpoint: string; method: string; cases: string }[];
  performanceTests: { scenario: string; metric: string; target: string }[];
  bugReportTemplate: string;
}

// ===== Security section (Agent 09 - Security Reviewer) =====
export interface SecurityData {
  threats: { risk: string; severity: string; mitigation: string }[];
  authFlow: string;
  authzModel: string;
  dataProtection: string;
  owaspChecklist: { category: string; status: string; note: string }[];
  rateLimit: string;
  secrets: string;
}

// ===== Project result (all sections) =====
export interface ProjectResult {
  analysis: AnalysisData;
  hr: HRData;
  sprint: SprintData;
  design: DesignData;
  uml: UMLData;
  docs: DocsData;
  git: GitData;
  test?: TestData;
  security?: SecurityData;
}

// ===== Task (todolist) =====
export interface TaskItem {
  id?: string;
  assigneeName: string;
  memberId?: string;
  title: string;
  description: string;
  role: string;
  responsibilities: string[];
  codeConventions: string[];
  dependencies: string;
  acceptanceCriteria: string[];
  deadline: string;
  sprintName: string;
  status: string;
  hours: number;
  priority: string;
}

// ===== SSE progress events =====
export type ProgressEvent =
  | { type: "agent_start"; id: string; name: string; index: number; total: number }
  | { type: "agent_done"; id: string; name: string; index: number }
  | { type: "agent_fail"; id: string; name: string; error: string; index: number }
  | { type: "result"; data: ProjectResult }
  | { type: "error"; message: string };

// ===== Access role =====
export type AccessRole = "leader" | "member";

export interface AccessInfo {
  role: AccessRole;
  projectId: string;
  memberId?: string;
  name: string;
  email?: string;
}
