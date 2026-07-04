"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ProjectResult,
  SectionType,
  TaskItem,
  AccessInfo,
  MemberInput,
} from "@/lib/types";

/* ===========================================================
   Types
=========================================================== */
export interface MemberView {
  id: string;
  name: string;
  email: string;
  strengths: string;
  weaknesses: string;
  role: string;
  joinedAt: string | null;
  inviteToken?: string; // only present for leader
}

export interface ChatMessageView {
  id: string;
  authorName: string;
  authorRole: string; // leader | member | ai
  message: string;
  createdAt: string;
}

export interface EmailView {
  id: string;
  toEmail: string;
  toName: string;
  subject: string;
  body: string;
  type: string;
  sentAt: string;
}

export interface EditProposalView {
  id: string;
  section: string;
  requestedChange: string;
  status: string;
  memberName?: string;
  createdAt: string;
}

export interface ProjectView {
  id: string;
  topic: string;
  description: string;
  purpose: string;
  status: string;
  leaderName: string;
  leaderEmail: string;
  githubConnected?: boolean;
  githubUsername?: string | null;
  githubRepoName?: string | null;
  githubPushedAt?: string | null;
}

/* ===========================================================
   Pipeline progress (live SSE)
=========================================================== */
export interface AgentProgress {
  id: string;
  name: string;
  status: "pending" | "running" | "done" | "failed";
  error?: string;
}

export type LogLevel = "info" | "success" | "warn" | "error";

export interface LogEntry {
  id: string;
  ts: number;
  level: LogLevel;
  agentId?: string;
  provider?: "openrouter" | "cache" | "fallback" | "pipeline";
  model?: string;
  keyIndex?: number;
  message: string;
}

/* ===========================================================
   Store
=========================================================== */
interface NexusState {
  // routing
  view: "input" | "workspace" | "home" | "all-projects" | "agent-hub";
  projectId: string | null;
  token: string | null;
  access: AccessInfo | null;

  // input form
  input: {
    topic: string;
    description: string;
    purpose: string;
    extraInfo: {
      requirements: string;
      specialReqs: string;
      techPrefs: string;
      langPrefs: string;
    };
    leaderName: string;
    leaderEmail: string;
    leaderSmtpPassword: string;
    members: MemberInput[];
  };

  // pipeline
  pipelineRunning: boolean;
  agents: AgentProgress[];
  pipelineError: string | null;
  logs: LogEntry[];

  // init (task generation)
  initRunning: boolean;
  initLogs: LogEntry[];
  initError: string | null;

  // refine
  refineRunning: boolean;
  refineLogs: LogEntry[];
  refineError: string | null;

  // workspace
  project: ProjectView | null;
  result: ProjectResult | null;
  members: MemberView[];
  messages: ChatMessageView[];
  tasks: TaskItem[];
  emails: EmailView[];
  proposals: EditProposalView[];
  activeTab: SectionType | "chat" | "members" | "tasks" | "mailbox" | "history" | "agenthub";
  loadingProject: boolean;

  // refine
  refining: boolean;
  refineSectionDone: Record<string, boolean>;

  // actions
  setView: (v: "input" | "workspace" | "home" | "all-projects" | "agent-hub") => void;
  setRoute: (projectId: string | null, token: string | null) => void;
  setInput: (patch: Partial<NexusState["input"]>) => void;
  setMember: (index: number, patch: Partial<MemberInput>) => void;
  addMember: () => void;
  removeMember: (index: number) => void;
  resetInput: () => void;

  startPipeline: () => void;
  setAgentStatus: (id: string, status: AgentProgress["status"], error?: string) => void;
  setPipelineError: (msg: string | null) => void;
  setLogs: (logs: LogEntry[]) => void;
  finishPipeline: (projectId: string, token: string) => void;

  setInitRunning: (b: boolean) => void;
  setInitLogs: (logs: LogEntry[]) => void;
  setInitError: (msg: string | null) => void;

  setRefineRunning: (b: boolean) => void;
  setRefineLogs: (logs: LogEntry[]) => void;
  setRefineError: (msg: string | null) => void;

  setAccess: (a: AccessInfo | null) => void;
  setProject: (p: ProjectView | null) => void;
  setResult: (r: ProjectResult | null) => void;
  setMembers: (m: MemberView[]) => void;
  setMessages: (m: ChatMessageView[]) => void;
  addMessage: (m: ChatMessageView) => void;
  setTasks: (t: TaskItem[]) => void;
  setEmails: (e: EmailView[]) => void;
  setProposals: (p: EditProposalView[]) => void;
  setActiveTab: (t: NexusState["activeTab"]) => void;
  setLoadingProject: (b: boolean) => void;
  updateTaskStatus: (taskId: string, status: string) => void;

  setRefining: (b: boolean) => void;
  setRefineSection: (section: string, done: boolean) => void;
}

const defaultInput = {
  topic: "",
  description: "",
  purpose: "",
  extraInfo: {
    requirements: "",
    specialReqs: "",
    techPrefs: "",
    langPrefs: "",
  },
  leaderName: "",
  leaderEmail: "",
  leaderSmtpPassword: "",
  members: [
    { name: "", email: "", strengths: "", weaknesses: "" },
    { name: "", email: "", strengths: "", weaknesses: "" },
    { name: "", email: "", strengths: "", weaknesses: "" },
  ],
};

export const useNexus = create<NexusState>()(
  persist(
    (set) => ({
  view: "home",
  projectId: null,
  token: null,
  access: null,

  input: defaultInput,

  pipelineRunning: false,
  agents: [],
  pipelineError: null,
  logs: [],

  initRunning: false,
  initLogs: [],
  initError: null,

  refineRunning: false,
  refineLogs: [],
  refineError: null,

  project: null,
  result: null,
  members: [],
  messages: [],
  tasks: [],
  emails: [],
  proposals: [],
  activeTab: "analysis",
  loadingProject: false,

  refining: false,
  refineSectionDone: {},

  setView: (v) => set({ view: v }),
  setRoute: (projectId, token) => set({ projectId, token }),
  setInput: (patch) =>
    set((s) => ({
      input: {
        ...s.input,
        ...patch,
        // Deep-merge extraInfo so partial updates don't lose fields
        extraInfo: patch.extraInfo
          ? { ...s.input.extraInfo, ...patch.extraInfo }
          : s.input.extraInfo,
      },
    })),
  setMember: (index, patch) =>
    set((s) => {
      const members = [...s.input.members];
      members[index] = { ...members[index], ...patch };
      return { input: { ...s.input, members } };
    }),
  addMember: () =>
    set((s) => ({
      input: {
        ...s.input,
        members: [...s.input.members, { name: "", email: "", strengths: "", weaknesses: "" }],
      },
    })),
  removeMember: (index) =>
    set((s) => {
      if (s.input.members.length <= 1) return s;
      const members = s.input.members.filter((_, i) => i !== index);
      return { input: { ...s.input, members } };
    }),
  resetInput: () => set({ input: defaultInput }),

  startPipeline: () =>
    set({
      pipelineRunning: true,
      pipelineError: null,
      logs: [],
      agents: [
        { id: "01", name: "Requirement Analyst", status: "pending" },
        { id: "02", name: "HR Planner", status: "pending" },
        { id: "03", name: "Sprint Planner", status: "pending" },
        { id: "04", name: "System Architect", status: "pending" },
        { id: "05", name: "UML Generator", status: "pending" },
        { id: "06", name: "Technical Writer", status: "pending" },
        { id: "07", name: "Git / DevOps", status: "pending" },
        { id: "08", name: "Software Tester", status: "pending" },
        { id: "09", name: "Security Reviewer", status: "pending" },
        { id: "10", name: "Quality Reviewer", status: "pending" },
      ],
    }),
  setAgentStatus: (id, status, error) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, status, error } : a)),
    })),
  setPipelineError: (msg) => set({ pipelineError: msg }),
  setLogs: (logs) => set({ logs }),
  finishPipeline: (projectId, token) =>
    set({
      pipelineRunning: false,
      projectId,
      token,
      view: "workspace",
    }),

  setInitRunning: (b) => set({ initRunning: b }),
  setInitLogs: (logs) => set({ initLogs: logs }),
  setInitError: (msg) => set({ initError: msg }),

  setRefineRunning: (b) => set({ refineRunning: b }),
  setRefineLogs: (logs) => set({ refineLogs: logs }),
  setRefineError: (msg) => set({ refineError: msg }),

  setAccess: (a) => set({ access: a }),
  setProject: (p) => set({ project: p }),
  setResult: (r) => set({ result: r }),
  setMembers: (m) => set({ members: m }),
  setMessages: (m) => set({ messages: m }),
  addMessage: (m) =>
    set((s) => {
      // Deduplicate: skip if same author + message + within 2s
      const exists = s.messages.some(
        (existing) =>
          existing.authorName === m.authorName &&
          existing.message === m.message &&
          Math.abs(
            new Date(existing.createdAt).getTime() - new Date(m.createdAt).getTime()
          ) < 2000
      );
      if (exists) return s;
      return { messages: [...s.messages, m] };
    }),
  setTasks: (t) => set({ tasks: t }),
  setEmails: (e) => set({ emails: e }),
  setProposals: (p) => set({ proposals: p }),
  setActiveTab: (t) => set({ activeTab: t }),
  setLoadingProject: (b) => set({ loadingProject: b }),
  updateTaskStatus: (taskId, status) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, status, updatedAt: new Date().toISOString() as unknown as Date }
          : t
      ),
    })),

  setRefining: (b) => set({ refining: b }),
  setRefineSection: (section, done) =>
    set((s) => ({ refineSectionDone: { ...s.refineSectionDone, [section]: done } })),
}),
    {
      name: "nexus-storage",
      // Only persist input form + route info (not transient state like pipelineRunning)
      partialize: (s) => ({
        input: s.input,
        projectId: s.projectId,
        token: s.token,
        activeTab: s.activeTab,
      }),
    }
  )
);
