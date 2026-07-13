"use client";

import { useState } from "react";
import { notify } from "@/lib/notify";
import { useNexus } from "@/store/useNexus";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Brain,
  GitBranch,
  Shield,
  RefreshCw,
  Database,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Workflow as WorkflowIcon,
  ArrowDown,
  Network,
  Lock,
  KeyRound,
  Timer,
  MemoryStick,
  Stethoscope,
  ScanLine,
  Cpu,
  Boxes,
  ArrowRight,
  Activity,
} from "lucide-react";
import { AppSidebar } from "./AppSidebar";

/* ===================== Static data ===================== */

type PhaseTone = "success" | "retry" | "fallback" | "active" | "normal";

interface PipelinePhase {
  index: string;
  name: string;
  agents: string[];
  mode: "Sequential" | "Parallel" | "Single" | "Hybrid";
  description: string;
  tone: PhaseTone;
}

const PIPELINE_PHASES: PipelinePhase[] = [
  {
    index: "0",
    name: "Planner Agent",
    agents: ["Planner"],
    mode: "Single",
    description: "Phân tách topic thành các module độc lập để các agent xử lý.",
    tone: "active",
  },
  {
    index: "1",
    name: "Phân tích nghiệp vụ",
    agents: ["Analysis", "HR", "Sprint"],
    mode: "Sequential",
    description: "Chạy tuần tự: analysis → hr → sprint. Mỗi agent chờ agent trước hoàn thành.",
    tone: "success",
  },
  {
    index: "2",
    name: "Sinh artifacts song song",
    agents: ["Design", "UML", "Docs", "Git"],
    mode: "Parallel",
    description: "4 agent chạy đồng thời để tối ưu thời gian pipeline.",
    tone: "success",
  },
  {
    index: "3",
    name: "Kiểm thử & Bảo mật",
    agents: ["Test", "Security"],
    mode: "Parallel",
    description: "Test cases và security scan chạy song song sau khi artifacts sẵn sàng.",
    tone: "success",
  },
  {
    index: "4",
    name: "Retry agent thất bại",
    agents: ["Retry Queue"],
    mode: "Sequential",
    description: "Chờ 5s rồi retry các agent fail. Tối đa 3 lần trước khi bỏ qua.",
    tone: "retry",
  },
  {
    index: "5",
    name: "Static Fallback",
    agents: ["Fallback"],
    mode: "Single",
    description: "Nếu retry vẫn fail → nạp dữ liệu tĩnh (không crash pipeline).",
    tone: "fallback",
  },
  {
    index: "5.5",
    name: "Output Normalizer + Consistency",
    agents: ["Normalizer", "Consistency Checker"],
    mode: "Hybrid",
    description: "Chuẩn hóa output schema và kiểm tra tính nhất quán giữa các agent.",
    tone: "active",
  },
  {
    index: "6",
    name: "Quality Reviewer",
    agents: ["Reviewer"],
    mode: "Single",
    description: "Merge tất cả artifacts + validate bằng Zod schema trước khi trả về.",
    tone: "success",
  },
];

interface SplitAgent {
  id: string;
  name: string;
  agentNo: string;
  icon: typeof Database;
  color: string;
  subTasks: { label: string; key: string }[];
}

const SPLIT_AGENTS: SplitAgent[] = [
  {
    id: "design",
    name: "Design",
    agentNo: "Agent 04",
    icon: Layers,
    color: "from-blue-500/20 to-cyan-600/5",
    subTasks: [
      { label: "DB Schema", key: "dbTables" },
      { label: "API Endpoints", key: "apiEndpoints" },
      { label: "Architecture", key: "folderStructure" },
    ],
  },
  {
    id: "uml",
    name: "UML",
    agentNo: "Agent 05",
    icon: Network,
    color: "from-purple-500/20 to-indigo-600/5",
    subTasks: [
      { label: "Use Case", key: "graph TD" },
      { label: "Class + ERD", key: "classDiagram + erDiagram" },
      { label: "Sequence", key: "sequenceDiagram" },
    ],
  },
  {
    id: "docs",
    name: "Docs",
    agentNo: "Agent 06",
    icon: FileText,
    color: "from-emerald-500/20 to-teal-600/5",
    subTasks: [
      { label: "README", key: "readme" },
      { label: "Convention", key: "convention" },
      { label: "API Standard", key: "apiStandard" },
    ],
  },
];

interface AntiRateLimitFeature {
  title: string;
  description: string;
  icon: typeof Zap;
  tone: "primary" | "amber" | "emerald" | "cyan" | "violet" | "rose";
}

const ANTI_RATE_LIMIT_FEATURES: AntiRateLimitFeature[] = [
  {
    title: "Circuit Breaker",
    description: "3 lần fail liên tiếp → skip agent 3 phút để giảm tải provider.",
    icon: Zap,
    tone: "primary",
  },
  {
    title: "Dead Model Recovery",
    description: "Model cooldown 2 phút trước khi thử lại. Tự động phục hồi sau timeout.",
    icon: RefreshCw,
    tone: "amber",
  },
  {
    title: "Health Score",
    description: "Sắp xếp model theo điểm sức khỏe, ưu tiên model khỏe nhất trước.",
    icon: Activity,
    tone: "emerald",
  },
  {
    title: "Multi-Key Rotation",
    description: "Tự động chuyển API key khi gặp 429. Đảm bảo request không bị drop.",
    icon: KeyRound,
    tone: "cyan",
  },
  {
    title: "60s Wait on 429",
    description: "Khi nhận 429, chờ đúng 60s rồi retry (theo Retry-After header).",
    icon: Timer,
    tone: "violet",
  },
  {
    title: "In-memory Prompt Cache",
    description: "Cache prompt → response 1 giờ (TTL). Tránh gọi lại model cho input trùng.",
    icon: MemoryStick,
    tone: "primary",
  },
  {
    title: "Self-Healing Mermaid",
    description: "Auto-fix syntax Mermaid hỏng bằng LLM repair. Không crash khi render.",
    icon: Stethoscope,
    tone: "rose",
  },
  {
    title: "Self-Critic",
    description: "Reject output rỗng / degenerated. Bắt agent sinh lại cho đủ tiêu chuẩn.",
    icon: ScanLine,
    tone: "amber",
  },
];

interface DagEdge {
  from: string;
  to: string;
  type: "sequential" | "parallel" | "dependency";
}

const DAG_NODES = [
  { id: "analysis", label: "Analysis", icon: Brain },
  { id: "hr", label: "HR", icon: Users_ },
  { id: "sprint", label: "Sprint", icon: Boxes },
  { id: "design", label: "Design", icon: Layers },
  { id: "uml", label: "UML", icon: Network },
  { id: "docs", label: "Docs", icon: FileText },
  { id: "git", label: "Git", icon: GitBranch },
  { id: "test", label: "Test", icon: CheckCircle2 },
  { id: "security", label: "Security", icon: Shield },
];

// Lightweight local icon to avoid importing extra lucide icons
function Users_({ className }: { className?: string }) {
  return <Activity className={className} />;
}

const DAG_EDGES: DagEdge[] = [
  { from: "analysis", to: "hr", type: "sequential" },
  { from: "hr", to: "sprint", type: "sequential" },
  { from: "analysis", to: "design", type: "parallel" },
  { from: "analysis", to: "uml", type: "parallel" },
  { from: "analysis", to: "docs", type: "parallel" },
  { from: "analysis", to: "git", type: "parallel" },
  { from: "design", to: "uml", type: "dependency" },
  { from: "design", to: "docs", type: "dependency" },
  { from: "analysis", to: "test", type: "parallel" },
  { from: "analysis", to: "security", type: "parallel" },
];

/* ===================== Helpers ===================== */

const TONE_STYLES: Record<PhaseTone, { border: string; badge: string; glow: string; label: string }> = {
  success: {
    border: "border-emerald-500/40",
    badge: "bg-emerald-500/15 text-emerald-400",
    glow: "shadow-emerald-500/10",
    label: "Thành công",
  },
  retry: {
    border: "border-amber-500/40",
    badge: "bg-amber-500/15 text-amber-400",
    glow: "shadow-amber-500/10",
    label: "Retry",
  },
  fallback: {
    border: "border-red-500/40",
    badge: "bg-red-500/15 text-red-400",
    glow: "shadow-red-500/10",
    label: "Fallback",
  },
  active: {
    border: "border-primary/50",
    badge: "bg-primary/15 text-primary",
    glow: "shadow-primary/10",
    label: "Active",
  },
  normal: {
    border: "border-border/50",
    badge: "bg-muted/15 text-muted-foreground",
    glow: "",
    label: "Normal",
  },
};

const FEATURE_TONE_STYLES: Record<AntiRateLimitFeature["tone"], { border: string; icon: string }> = {
  primary: { border: "border-primary/30", icon: "text-primary" },
  amber: { border: "border-amber-500/30", icon: "text-amber-400" },
  emerald: { border: "border-emerald-500/30", icon: "text-emerald-400" },
  cyan: { border: "border-cyan-500/30", icon: "text-cyan-400" },
  violet: { border: "border-violet-500/30", icon: "text-violet-400" },
  rose: { border: "border-rose-500/30", icon: "text-rose-400" },
};

const EDGE_STYLES: Record<DagEdge["type"], { color: string; label: string }> = {
  sequential: { color: "text-emerald-400", label: "tuần tự" },
  parallel: { color: "text-cyan-400", label: "song song" },
  dependency: { color: "text-violet-400", label: "phụ thuộc" },
};

/* ===================== Component ===================== */

export function WorkflowView() {
  const setView = useNexus((s) => s.setView);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  function handlePhaseClick(phase: PipelinePhase) {
    setSelectedPhase(phase.index === selectedPhase ? null : phase.index);
    notify.info(`Phase ${phase.index}: ${phase.name}`, {
      description: phase.description,
    });
  }

  return (
    <main className="flex-1 flex flex-col bg-nexus-bg/95 min-h-screen nexus-boot">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-nexus-bg/90 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("home")}
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="Về trang tổng quan"
            >
              <Cpu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <WorkflowIcon className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Workflow Pipeline</h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Multi-Agent DAG · 8 phases
                </p>
              </div>
            </div>
          </div>
          <Badge className="bg-primary/15 text-primary border-0 hidden sm:inline-flex">
            <Activity className="w-3 h-3 mr-1" />
            Production
          </Badge>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <AppSidebar active="workflow" />
        <div className="flex-1 overflow-y-auto nexus-scroll">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-10">
            {/* ===================== Section 1: Pipeline Overview ===================== */}
            <section>
              <SectionHeader
                icon={WorkflowIcon}
                title="Pipeline Overview"
                subtitle="8 phases · Sequential + Parallel execution"
              />
              <div className="relative">
                <div className="space-y-0">
                  {PIPELINE_PHASES.map((phase, idx) => {
                    const tone = TONE_STYLES[phase.tone];
                    const isLast = idx === PIPELINE_PHASES.length - 1;
                    const isSelected = selectedPhase === phase.index;
                    return (
                      <div key={phase.index} className="relative">
                        {/* Phase card */}
                        <button
                          onClick={() => handlePhaseClick(phase)}
                          className={`w-full text-left rounded-2xl border ${tone.border} ${
                            isSelected ? "ring-2 ring-primary/40" : ""
                          } bg-card/40 backdrop-blur-xl p-4 sm:p-5 nexus-hud shadow-lg ${tone.glow} transition-all hover:scale-[1.01] hover:shadow-primary/10`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                            {/* Phase index */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className={`w-10 h-10 rounded-xl ${tone.badge} flex items-center justify-center font-bold text-sm`}>
                                {phase.index}
                              </div>
                              <Badge className={`${tone.badge} border-0 whitespace-nowrap`}>
                                {tone.label}
                              </Badge>
                            </div>
                            {/* Phase content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-bold text-sm">{phase.name}</h3>
                                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                                  · {phase.mode}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{phase.description}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {phase.agents.map((agent) => (
                                  <span
                                    key={agent}
                                    className="text-[10px] bg-nexus-surface-2 text-foreground/80 px-2 py-0.5 rounded-md border border-border/40 font-mono"
                                  >
                                    {agent}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </button>
                        {/* Connector arrow */}
                        {!isLast && (
                          <div className="flex justify-center py-2" aria-hidden>
                            <ArrowDown className="w-4 h-4 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ===================== Section 2: Split Agent Architecture ===================== */}
            <section>
              <SectionHeader
                icon={Layers}
                title="Split Agent Architecture"
                subtitle="Design / UML / Docs chia thành sub-tasks độc lập"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {SPLIT_AGENTS.map((agent) => {
                  const Icon = agent.icon;
                  return (
                    <div
                      key={agent.id}
                      className={`rounded-2xl border border-border/40 bg-gradient-to-br ${agent.color} backdrop-blur-xl p-5 nexus-hud shadow-lg hover:shadow-primary/10 transition-all`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-card/60 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">{agent.name}</h3>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {agent.agentNo} · 3 sub-tasks
                          </p>
                        </div>
                      </div>
                      <ul className="space-y-2">
                        {agent.subTasks.map((sub, sIdx) => (
                          <li
                            key={sub.key}
                            className="flex items-start gap-2 rounded-lg bg-nexus-surface-2/60 border border-border/30 px-3 py-2"
                          >
                            <span className="text-primary font-mono text-[10px] mt-0.5">
                              {sIdx === agent.subTasks.length - 1 ? "└─" : "├─"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium">{sub.label}</div>
                              <div className="text-[10px] text-muted-foreground font-mono truncate">
                                {sub.key}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ===================== Section 3: Anti-Rate-Limit Features ===================== */}
            <section>
              <SectionHeader
                icon={Shield}
                title="Anti-Rate-Limit Features"
                subtitle="8 cơ chế bảo vệ pipeline khỏi rate limit & degeneration"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {ANTI_RATE_LIMIT_FEATURES.map((feature) => {
                  const Icon = feature.icon;
                  const tone = FEATURE_TONE_STYLES[feature.tone];
                  return (
                    <div
                      key={feature.title}
                      className={`rounded-2xl border ${tone.border} bg-card/40 backdrop-blur-xl p-4 nexus-hud shadow-lg hover:shadow-primary/10 transition-all group`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-nexus-surface-2 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Icon className={`w-4.5 h-4.5 ${tone.icon}`} />
                        </div>
                        <h3 className="font-bold text-xs leading-tight">{feature.title}</h3>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ===================== Section 4: DAG Dependency Graph ===================== */}
            <section>
              <SectionHeader
                icon={Network}
                title="DAG Dependency Graph"
                subtitle="Mối quan hệ phụ thuộc giữa các agent"
              />
              <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl p-5 sm:p-6 nexus-hud shadow-lg">
                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 mb-5 pb-4 border-b border-border/30">
                  {(["sequential", "parallel", "dependency"] as DagEdge["type"][]).map((t) => {
                    const s = EDGE_STYLES[t];
                    return (
                      <div key={t} className="flex items-center gap-2">
                        <ArrowRight className={`w-3.5 h-3.5 ${s.color}`} />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Nodes grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                  {DAG_NODES.map((node) => {
                    const Icon = node.icon;
                    return (
                      <div
                        key={node.id}
                        className="rounded-xl border border-border/50 bg-nexus-surface-2/60 p-3 flex items-center gap-2 hover:border-primary/40 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold">{node.label}</div>
                          <div className="text-[9px] text-muted-foreground font-mono truncate">
                            {node.id}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Edges list */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">
                    Edges · {DAG_EDGES.length} dependencies
                  </div>
                  {DAG_EDGES.map((edge, idx) => {
                    const fromNode = DAG_NODES.find((n) => n.id === edge.from);
                    const toNode = DAG_NODES.find((n) => n.id === edge.to);
                    if (!fromNode || !toNode) return null;
                    const style = EDGE_STYLES[edge.type];
                    return (
                      <div
                        key={`${edge.from}-${edge.to}-${idx}`}
                        className="flex items-center gap-2 rounded-lg bg-nexus-surface-2/40 border border-border/20 px-3 py-1.5 text-xs"
                      >
                        <span className="font-mono text-foreground/80">{fromNode.label}</span>
                        <ArrowRight className={`w-3.5 h-3.5 ${style.color} flex-shrink-0`} />
                        <span className="font-mono text-foreground/80">{toNode.label}</span>
                        <Badge className={`ml-auto bg-transparent ${style.color} border border-current/30 text-[9px]`}>
                          {style.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InfoNote
                  icon={AlertTriangle}
                  tone="amber"
                  title="UML cần DB tables"
                  text="design → uml: UML phụ thuộc schema DB từ Design agent."
                />
                <InfoNote
                  icon={AlertTriangle}
                  tone="violet"
                  title="Docs cần folder structure"
                  text="design → docs: Docs dùng folder structure để sinh convention."
                />
                <InfoNote
                  icon={Lock}
                  tone="emerald"
                  title="Test & Security song song"
                  text="analysis → test, security: Chạy độc lập để tối ưu tốc độ."
                />
              </div>
            </section>

            {/* Footer hint */}
            <div className="text-center text-[10px] text-muted-foreground/40 py-4 border-t border-border/20">
              NEXUS AI Multi-Agent · Pipeline DAG execution · Anti-rate-limit hardened
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ===================== Sub-components ===================== */

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Zap;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4.5 h-4.5 text-primary" />
      </div>
      <div>
        <h2 className="text-base font-bold leading-tight">{title}</h2>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function InfoNote({
  icon: Icon,
  tone,
  title,
  text,
}: {
  icon: typeof Zap;
  tone: "amber" | "violet" | "emerald";
  title: string;
  text: string;
}) {
  const toneMap = {
    amber: "border-amber-500/30 text-amber-400",
    violet: "border-violet-500/30 text-violet-400",
    emerald: "border-emerald-500/30 text-emerald-400",
  };
  return (
    <div className={`rounded-xl border ${toneMap[tone]} bg-card/30 backdrop-blur-md p-3`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${toneMap[tone].split(" ")[1]}`} />
        <h4 className="text-xs font-bold">{title}</h4>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}
