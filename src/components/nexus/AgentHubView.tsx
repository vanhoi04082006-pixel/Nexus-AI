"use client";

import { useEffect, useState, useCallback } from "react";
import { useNexus } from "@/store/useNexus";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Cpu,
  Plus,
  Brain,
  Terminal,
  Zap,
  Activity,
  Search,
  Settings,
  Code2,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Loader2,
  TrendingUp,
  Star,
  Bot,
  RefreshCw,
  Layers,
  GitBranch,
  Shield,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { AI3DBrain } from "./AI3DBrain";
import { AppSidebar } from "./AppSidebar";

const ICON_MAP: Record<string, typeof Code2> = {
  Code2, ShoppingBag, Settings, Smartphone, Sparkles, Brain, Terminal, Zap, Cpu, Bot, Activity, Star,
};

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  model: string;
  provider: string;
  temperature: number;
  status: string;
  description: string;
  skills: string[];
}

// Pipeline phase info for each agent
const AGENT_PHASES: Record<string, { phase: string; mode: string; split?: string }> = {
  "01": { phase: "Phase 1", mode: "Sequential" },
  "02": { phase: "Phase 1", mode: "Sequential" },
  "03": { phase: "Phase 1", mode: "Sequential" },
  "04": { phase: "Phase 2", mode: "Parallel", split: "3 sub-tasks (DB + API + Architecture)" },
  "05": { phase: "Phase 2", mode: "Parallel", split: "3 sub-tasks (UseCase + Class/ERD + Sequence)" },
  "06": { phase: "Phase 2", mode: "Parallel", split: "3 sub-tasks (README + Convention + API Standard)" },
  "07": { phase: "Phase 2", mode: "Parallel" },
  "08": { phase: "Phase 3", mode: "Parallel" },
  "09": { phase: "Phase 3", mode: "Parallel" },
  "10": { phase: "Phase 6", mode: "Review" },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: typeof CheckCircle2; label: string }> = {
  online: { color: "text-emerald-400", bg: "bg-emerald-500/15", icon: CheckCircle2, label: "Online" },
  busy: { color: "text-amber-400", bg: "bg-amber-500/15", icon: Clock, label: "Đang làm" },
  idle: { color: "text-cyan-400", bg: "bg-cyan-500/15", icon: Activity, label: "Sẵn sàng" },
  error: { color: "text-red-400", bg: "bg-red-500/15", icon: AlertCircle, label: "Lỗi" },
  offline: { color: "text-muted-foreground", bg: "bg-secondary/20", icon: AlertCircle, label: "Offline" },
};

const MARKETPLACE_AGENTS = [
  { name: "Laravel Expert", role: "Backend", desc: "PHP / Laravel / Eloquent", icon: "Code2", color: "from-red-500/20 to-orange-600/5", iconColor: "text-red-400" },
  { name: "Spring Boot Expert", role: "Backend", desc: "Java / Spring / JPA", icon: "Code2", color: "from-green-500/20 to-emerald-600/5", iconColor: "text-green-400" },
  { name: "Flutter Expert", role: "Mobile", desc: "Dart / Flutter / BLoC", icon: "Smartphone", color: "from-blue-500/20 to-cyan-600/5", iconColor: "text-blue-400" },
  { name: "Unity Expert", role: "Game Dev", desc: "C# / Unity / Game logic", icon: "Sparkles", color: "from-purple-500/20 to-indigo-600/5", iconColor: "text-purple-400" },
  { name: "Data Scientist", role: "AI/ML", desc: "Python / Pandas / Scikit-learn", icon: "Brain", color: "from-amber-400/20 to-orange-600/5", iconColor: "text-amber-400" },
  { name: "SEO Writer", role: "Content", desc: "SEO / Blog / Marketing copy", icon: "Terminal", color: "from-cyan-500/20 to-teal-600/5", iconColor: "text-cyan-400" },
];

export function AgentHubView() {
  const setView = useNexus((s) => s.setView);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, online: 0, working: 0, idle: 0, error: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"agents" | "marketplace" | "builder">("agents");
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const resp = await fetch("/api/agents");
      if (resp.ok) {
        const data = await resp.json();
        setAgents(data.agents || []);
        setStats(data.stats || { total: 0, online: 0, working: 0, idle: 0, error: 0 });
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadAgents();
    // Refresh every 30s
    const interval = setInterval(loadAgents, 30000);
    return () => clearInterval(interval);
  }, [loadAgents]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredAgents = searchQuery.trim()
    ? agents.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.role.toLowerCase().includes(searchQuery.toLowerCase()))
    : agents;

  return (
    <main className="flex-1 flex flex-col bg-nexus-bg/95 min-h-screen nexus-boot">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-nexus-bg/90 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("home")} className="text-muted-foreground hover:text-primary transition-colors" aria-label="Về trang chủ">
              <Cpu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">Agent Hub</h1>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">10 Agents</Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { loadAgents(); notify.success("Đã làm mới danh sách Agent"); }} className="text-muted-foreground">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <AppSidebar active="agent-hub" />
        <div className="flex-1 overflow-y-auto nexus-scroll">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Stats overview */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <div className="rounded-2xl bg-card/30 backdrop-blur-md border border-border/50 p-4 text-center shadow-inner">
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
              <div className="text-[10px] text-muted-foreground">Tổng Agents</div>
            </div>
            <div className="rounded-2xl bg-card/30 backdrop-blur-md border border-border/50 p-4 text-center shadow-inner">
              <div className="text-2xl font-bold text-emerald-400">{stats.online}</div>
              <div className="text-[10px] text-muted-foreground">Online</div>
            </div>
            <div className="rounded-2xl bg-card/30 backdrop-blur-md border border-border/50 p-4 text-center shadow-inner">
              <div className="text-2xl font-bold text-amber-400">{stats.working}</div>
              <div className="text-[10px] text-muted-foreground">Đang làm</div>
            </div>
            <div className="rounded-2xl bg-card/30 backdrop-blur-md border border-border/50 p-4 text-center shadow-inner">
              <div className="text-2xl font-bold text-cyan-400">{stats.idle}</div>
              <div className="text-[10px] text-muted-foreground">Sẵn sàng</div>
            </div>
            <div className="rounded-2xl bg-card/30 backdrop-blur-md border border-border/50 p-4 text-center shadow-inner">
              <div className="text-2xl font-bold text-red-400">{stats.error}</div>
              <div className="text-[10px] text-muted-foreground">Lỗi</div>
            </div>
          </div>

          {/* Pipeline Architecture Info */}
          <div className="rounded-xl bg-primary/[0.06] border border-primary/20 p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold">Kiến trúc Split Prompt + Merge Output</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              3 Agent phức tạp (Design, UML, Docs) được phân rã thành 3 sub-task mỗi agent — Single Responsibility.
              Mỗi sub-task chạy song song, kết quả merge lại thành 1 section hoàn chỉnh.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-card/40 rounded-lg p-2 text-xs">
                <span className="text-primary font-semibold">Agent 04 (Design)</span> → DB + API + Architecture
              </div>
              <div className="bg-card/40 rounded-lg p-2 text-xs">
                <span className="text-primary font-semibold">Agent 05 (UML)</span> → UseCase + Class/ERD + Sequence
              </div>
              <div className="bg-card/40 rounded-lg p-2 text-xs">
                <span className="text-primary font-semibold">Agent 06 (Docs)</span> → README + Convention + API Standard
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 mb-6">
            <button onClick={() => setActiveTab("agents")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "agents" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Bot className="w-4 h-4 inline mr-1.5" /> 10 Agents ({agents.length})
            </button>
            <button onClick={() => setActiveTab("marketplace")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "marketplace" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Sparkles className="w-4 h-4 inline mr-1.5" /> Marketplace
            </button>
            <button onClick={() => setActiveTab("builder")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "builder" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Plus className="w-4 h-4 inline mr-1.5" /> Builder
            </button>
          </div>

          {/* Search */}
          {activeTab === "agents" && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/40 border border-border/50 backdrop-blur-md mb-6 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground/60" />
              <input type="text" placeholder="Tìm agent theo tên hoặc vai trò..." className="flex-1 bg-transparent text-sm outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="Tìm agent" />
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
          ) : activeTab === "agents" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAgents.map((agent) => {
                const phaseInfo = AGENT_PHASES[agent.id] || { phase: "—", mode: "—" };
                const statusConfig = STATUS_CONFIG[agent.status] || STATUS_CONFIG.online;
                const StatusIcon = statusConfig.icon;
                return (
                  <div
                    key={agent.id}
                    className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-xl p-5 nexus-hud shadow-lg shadow-primary/5 hover:shadow-primary/20 transition-all group cursor-pointer"
                    onClick={() => setSelectedAgent(agent)}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center nexus-flicker">
                          <Bot className="w-6 h-6 text-primary" />
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${statusConfig.bg} border-2 border-card flex items-center justify-center`}>
                          <StatusIcon className={`w-2 h-2 ${statusConfig.color}`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm group-hover:text-primary transition-colors">{agent.name}</h3>
                          <Badge variant="outline" className="text-[9px] text-muted-foreground">#{agent.id}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{agent.role}</p>
                      </div>
                      <Badge className={`text-[9px] ${statusConfig.bg} ${statusConfig.color} border-0`}>{statusConfig.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{agent.description}</p>
                    {/* Model info */}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2 font-mono">
                      <Cpu className="w-3 h-3" />
                      <span className="truncate">{agent.model}</span>
                    </div>
                    {/* Phase + Mode info */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3">
                      <span className="flex items-center gap-1"><Layers className="w-2.5 h-2.5" /> {phaseInfo.phase}</span>
                      <span className="flex items-center gap-1"><Zap className="w-2.5 h-2.5" /> {phaseInfo.mode}</span>
                      {phaseInfo.split && (
                        <Badge className="text-[9px] bg-primary/10 text-primary border-0">⚡ Split</Badge>
                      )}
                    </div>
                    {/* Skills */}
                    <div className="flex flex-wrap gap-1.5">
                      {agent.skills.map((skill) => (
                        <span key={skill} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">{skill}</span>
                      ))}
                    </div>
                    {/* Stats footer */}
                    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border/30 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Activity className="w-2.5 h-2.5" /> temp: {agent.temperature}</span>
                      <span className="flex items-center gap-1"><Zap className="w-2.5 h-2.5" /> {agent.provider}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeTab === "marketplace" ? (
            <div>
              <p className="text-sm text-muted-foreground mb-4">Cài đặt agent chuyên biệt từ thư viện cộng đồng.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {MARKETPLACE_AGENTS.map((ma) => {
                  const Icon = ICON_MAP[ma.icon] || Code2;
                  return (
                    <div key={ma.name} className={`rounded-2xl border border-border/40 bg-gradient-to-br ${ma.color} backdrop-blur-xl p-5 nexus-hud shadow-lg hover:shadow-primary/20 transition-all group`}>
                      <div className="w-12 h-12 rounded-xl bg-card/60 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Icon className={`w-6 h-6 ${ma.iconColor}`} />
                      </div>
                      <h3 className="font-bold text-sm mb-1">{ma.name}</h3>
                      <Badge variant="outline" className="text-[9px] text-muted-foreground mb-2">{ma.role}</Badge>
                      <p className="text-[10px] text-muted-foreground mb-3">{ma.desc}</p>
                      <Button size="sm" className="w-full bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20" onClick={() => notify.info("Tính năng đang phát triển")}>
                        <Plus className="w-3.5 h-3.5" /> Cài đặt
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Builder tab */
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-center mb-6"><AI3DBrain size={80} /></div>
              <h3 className="text-lg font-bold text-center mb-2">Agent Builder</h3>
              <p className="text-sm text-muted-foreground text-center mb-6">Tạo AI Agent mới với role, model, tools tùy chỉnh.</p>
              <div className="space-y-4 rounded-2xl border border-border/40 bg-card/50 backdrop-blur-xl p-6 nexus-hud">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 block">Tên Agent</label>
                  <input className="w-full px-3 py-2 rounded-lg bg-nexus-surface-2 border border-border text-sm outline-none focus:border-primary" placeholder="VD: Backend Expert" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 block">Role</label>
                    <select className="w-full px-3 py-2 rounded-lg bg-nexus-surface-2 border border-border text-sm outline-none">
                      <option>Architect</option><option>Backend Developer</option><option>Frontend Developer</option><option>Database Engineer</option><option>QA Tester</option><option>DevOps</option><option>Security</option><option>Technical Writer</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 block">Model</label>
                    <select className="w-full px-3 py-2 rounded-lg bg-nexus-surface-2 border border-border text-sm outline-none">
                      <option>openai/gpt-oss-120b:free</option><option>nvidia/nemotron-3-ultra-550b-a55b:free</option><option>google/gemma-4-31b-it:free</option><option>qwen/qwen3-coder:free</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-2 block">System Prompt</label>
                  <textarea rows={3} className="w-full px-3 py-2 rounded-lg bg-nexus-surface-2 border border-border text-sm outline-none focus:border-primary resize-none" placeholder="Hướng dẫn cho AI Agent..." />
                </div>
                <Button className="w-full bg-primary text-primary-foreground nexus-glow" onClick={() => notify.info("Tính năng đang phát triển")}>
                  <Plus className="w-4 h-4" /> Tạo Agent
                </Button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-50 flex items-center justify-center p-4" onClick={() => setSelectedAgent(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bot className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{selectedAgent.name}</h2>
                <p className="text-xs text-muted-foreground">{selectedAgent.role} · Agent #{selectedAgent.id}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{selectedAgent.description}</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Model:</span>
                <code className="text-primary">{selectedAgent.model}</code>
              </div>
              <div className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Provider:</span>
                <span>{selectedAgent.provider}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Temperature:</span>
                <span>{selectedAgent.temperature}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Phase:</span>
                <span>{AGENT_PHASES[selectedAgent.id]?.phase || "—"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">Mode:</span>
                <span>{AGENT_PHASES[selectedAgent.id]?.mode || "—"}</span>
              </div>
              {AGENT_PHASES[selectedAgent.id]?.split && (
                <div className="py-2 border-b border-border/30">
                  <span className="text-muted-foreground">Split:</span>
                  <p className="text-primary mt-1">{AGENT_PHASES[selectedAgent.id].split}</p>
                </div>
              )}
              <div className="py-2">
                <span className="text-muted-foreground">Skills:</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedAgent.skills.map((s) => (
                    <span key={s} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">{s}</span>
                  ))}
                </div>
              </div>
            </div>
            <Button variant="ghost" className="w-full mt-4" onClick={() => setSelectedAgent(null)}>Đóng</Button>
          </div>
        </div>
      )}
    </main>
  );
}
