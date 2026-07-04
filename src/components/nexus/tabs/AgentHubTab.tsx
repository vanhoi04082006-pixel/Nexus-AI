"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Cpu, Search, Users, CalendarCheck, Network, GitGraph, FileText,
  GitBranch, CheckSquare, Shield, Activity, Brain, Zap, Terminal,
} from "lucide-react";

const AGENTS = [
  { id: "01", name: "Requirement Analyst", icon: Search, color: "text-cyan-400", bgColor: "from-cyan-500/15 to-blue-600/5", borderColor: "border-cyan-500/30",
    models: "Nemotron Ultra → Qwen3-Next → GPT-OSS", temp: 0.20, status: "Online",
    skills: [{ name: "Requirement Analysis", level: 5 }, { name: "Tech Stack", level: 5 }, { name: "Feature Planning", level: 4 }],
    task: "Phân tích yêu cầu, tech stack, features, actors, modules" },
  { id: "02", name: "HR Planner", icon: Users, color: "text-emerald-400", bgColor: "from-emerald-500/15 to-teal-600/5", borderColor: "border-emerald-500/30",
    models: "Gemma-4-31b → Gemma-4-26b → Nemotron", temp: 0.25, status: "Online",
    skills: [{ name: "Role Assignment", level: 5 }, { name: "Workload Balance", level: 4 }, { name: "Risk Analysis", level: 4 }],
    task: "Phân vai trò, workload, rủi ro cho từng thành viên" },
  { id: "03", name: "Sprint Planner", icon: CalendarCheck, color: "text-amber-400", bgColor: "from-amber-400/15 to-orange-600/5", borderColor: "border-amber-400/30",
    models: "Nemotron Ultra → Nemotron Super → Qwen3", temp: 0.20, status: "Online",
    skills: [{ name: "Sprint Planning", level: 5 }, { name: "Milestone", level: 4 }, { name: "Timeline", level: 5 }],
    task: "Chia sprint 2 tuần, gán task, deadline, milestones" },
  { id: "04", name: "System Architect", icon: Network, color: "text-purple-400", bgColor: "from-purple-500/15 to-indigo-600/5", borderColor: "border-purple-500/30",
    models: "GPT-OSS-120b → Qwen3-Coder → Laguna", temp: 0.15, status: "Online",
    skills: [{ name: "DB Schema", level: 5 }, { name: "API Design", level: 5 }, { name: "Architecture", level: 5 }],
    task: "Thiết kế database schema, API endpoints, folder structure" },
  { id: "05", name: "UML Generator", icon: GitGraph, color: "text-rose-400", bgColor: "from-rose-500/15 to-pink-600/5", borderColor: "border-rose-500/30",
    models: "GPT-OSS-120b → Qwen3-Coder → North-Mini", temp: 0.10, status: "Online",
    skills: [{ name: "Use Case", level: 5 }, { name: "Class Diagram", level: 5 }, { name: "ERD", level: 5 }],
    task: "Sinh 4 diagram: Use Case, Class, ERD, Sequence (Mermaid)" },
  { id: "06", name: "Technical Writer", icon: FileText, color: "text-sky-400", bgColor: "from-sky-500/15 to-blue-600/5", borderColor: "border-sky-500/30",
    models: "Gemma-4-31b → Gemma-4-26b → Llama-3.3", temp: 0.35, status: "Online",
    skills: [{ name: "README", level: 5 }, { name: "Convention", level: 4 }, { name: "API Standard", level: 4 }],
    task: "Viết README, Coding Convention, API Response Standard" },
  { id: "07", name: "Git / DevOps", icon: GitBranch, color: "text-teal-400", bgColor: "from-teal-500/15 to-cyan-600/5", borderColor: "border-teal-500/30",
    models: "North-Mini-Code → Laguna → Qwen3-Coder", temp: 0.15, status: "Online",
    skills: [{ name: "Git Strategy", level: 5 }, { name: "CI/CD", level: 4 }, { name: "Docker", level: 4 }],
    task: "Git commands, branch strategy, issue template" },
  { id: "08", name: "Software Tester", icon: CheckSquare, color: "text-lime-400", bgColor: "from-lime-500/15 to-green-600/5", borderColor: "border-lime-500/30",
    models: "Qwen3-Coder → GPT-OSS-120b → North-Mini", temp: 0.20, status: "Online",
    skills: [{ name: "Unit Test", level: 5 }, { name: "E2E Test", level: 4 }, { name: "Performance", level: 4 }],
    task: "Sinh test plan: unit, integration, E2E, API, performance tests" },
  { id: "09", name: "Security Reviewer", icon: Shield, color: "text-red-400", bgColor: "from-red-500/15 to-rose-600/5", borderColor: "border-red-500/30",
    models: "GPT-OSS-120b → Qwen3-Next → Nemotron", temp: 0.15, status: "Online",
    skills: [{ name: "OWASP", level: 5 }, { name: "Auth Flow", level: 5 }, { name: "Threat Analysis", level: 5 }],
    task: "Phân tích threats, auth flow, OWASP Top 10, rate limiting" },
  { id: "10", name: "Quality Reviewer", icon: Brain, color: "text-primary", bgColor: "from-primary/15 to-cyan-600/5", borderColor: "border-primary/30",
    models: "GPT-OSS-120b → Qwen3-Next → Nemotron", temp: 0.10, status: "Online",
    skills: [{ name: "Consistency Check", level: 5 }, { name: "Schema Validation", level: 5 }, { name: "Sync", level: 5 }],
    task: "Tổng hợp + đồng bộ + Zod validate tất cả 9 sections" },
];

export function AgentHubTab() {
  const onlineCount = AGENTS.filter((a) => a.status === "Online").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold nexus-text-glow">Agent Hub</h2>
          <p className="text-sm text-muted-foreground mt-1">Trung tâm điều hành 10 AI Agent</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
            {onlineCount} Online
          </Badge>
          <Badge className="bg-primary/15 text-primary border-primary/30">
            <Zap className="w-3 h-3 mr-1" /> 10 Agents
          </Badge>
        </div>
      </div>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          return (
            <Card
              key={agent.id}
              className={`rounded-2xl border ${agent.borderColor} bg-gradient-to-br ${agent.bgColor} backdrop-blur-xl overflow-hidden nexus-hud shadow-lg shadow-primary/5 hover:shadow-primary/20 hover:-translate-y-1 transition-all`}
            >
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-card/60 backdrop-blur-sm flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-6 h-6 ${agent.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground">#{agent.id}</span>
                      <h3 className="font-bold text-sm truncate">{agent.name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-emerald-400">{agent.status}</span>
                      <span className="text-[10px] text-muted-foreground">· Temp {agent.temp}</span>
                    </div>
                  </div>
                </div>

                {/* Task description */}
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{agent.task}</p>

                {/* Models */}
                <div className="mb-3">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1">Models</div>
                  <p className="text-[10px] font-mono text-muted-foreground/80 truncate">{agent.models}</p>
                </div>

                {/* Skills */}
                <div className="mb-3">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1.5">Skills</div>
                  <div className="space-y-1">
                    {agent.skills.map((skill) => (
                      <div key={skill.name} className="flex items-center gap-2">
                        <span className="text-[10px] text-foreground/70 flex-1 truncate">{skill.name}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <div
                              key={star}
                              className={`w-1.5 h-1.5 rounded-full ${star <= skill.level ? "bg-primary" : "bg-border/40"}`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border/20">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Terminal className="w-3 h-3" />
                    <span>Pipeline Active</span>
                  </div>
                  <Activity className={`w-4 h-4 ${agent.color} nexus-spin-slow`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Workflow visualization */}
      <Card className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-md p-5 nexus-hud">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Pipeline Workflow</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {["Business", "Architect", "Database", "Backend", "Frontend", "QA", "Deploy"].map((stage, i, arr) => (
            <div key={stage} className="flex items-center gap-2">
              <div className={`px-3 py-1.5 rounded-lg border ${i === 0 ? "bg-primary/15 border-primary/30 text-primary" : "bg-card/40 border-border/40 text-muted-foreground"}`}>
                {stage}
              </div>
              {i < arr.length - 1 && <span className="text-muted-foreground/40">→</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
