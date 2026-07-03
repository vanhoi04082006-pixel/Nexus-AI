"use client";

import { useEffect, useState } from "react";
import { useNexus } from "@/store/useNexus";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Cpu,
  Plus,
  FolderOpen,
  Users,
  CheckSquare,
  Clock,
  ArrowRight,
  Trash2,
  Loader2,
  Sparkles,
  Rocket,
  Code2,
  ShoppingBag,
  Settings,
  Smartphone,
  Terminal,
  Activity,
  TrendingUp,
  Brain,
  Zap,
  Search,
  Bell,
} from "lucide-react";
import { AI3DBrain } from "./AI3DBrain";

interface ProjectHistoryItem {
  id: string;
  topic: string;
  description: string;
  status: string;
  leaderName: string;
  leaderToken: string;
  memberCount: number;
  taskCount: number;
  hasAnalysis: boolean;
  createdAt: string;
  updatedAt: string;
}

const HERO_GRADIENTS = [
  "from-cyan-600/30 via-blue-900/20 to-[#060b14]",
  "from-emerald-600/30 via-teal-900/20 to-[#060b14]",
  "from-purple-600/30 via-indigo-900/20 to-[#060b14]",
  "from-amber-500/30 via-orange-900/20 to-[#060b14]",
  "from-rose-600/30 via-pink-900/20 to-[#060b14]",
];

const CARD_GRADIENTS = [
  "from-cyan-500/15 to-blue-900/5",
  "from-emerald-500/15 to-teal-900/5",
  "from-purple-500/15 to-indigo-900/5",
  "from-amber-400/15 to-orange-900/5",
  "from-rose-500/15 to-pink-900/5",
];

const CARD_BORDER_COLORS = [
  "border-cyan-500/30",
  "border-emerald-500/30",
  "border-purple-500/30",
  "border-amber-400/30",
  "border-rose-500/30",
];

const STATUS_LABELS: Record<string, { text: string; color: string; pct: number }> = {
  INITIALIZED: { text: "Hoàn thành", color: "text-emerald-400 bg-emerald-500/15", pct: 100 },
  WORKSPACE: { text: "Đang làm việc", color: "text-primary bg-primary/15", pct: 60 },
  ANALYZING: { text: "Đang phân tích", color: "text-amber-400 bg-amber-500/15", pct: 30 },
  DRAFT: { text: "Bản nháp", color: "text-slate-400 bg-slate-500/15", pct: 10 },
};

const TEMPLATES = [
  { name: "Fullstack Web App", desc: "Next.js + Prisma + shadcn/ui", icon: Code2, color: "from-cyan-500/20 to-blue-600/5", iconColor: "text-cyan-400", border: "border-cyan-500/30" },
  { name: "E-commerce System", desc: "Shop + Payment + Inventory", icon: ShoppingBag, color: "from-emerald-500/20 to-teal-600/5", iconColor: "text-emerald-400", border: "border-emerald-500/30" },
  { name: "Management System", desc: "CRM / ERP / HRM dashboard", icon: Settings, color: "from-purple-500/20 to-indigo-600/5", iconColor: "text-purple-400", border: "border-purple-500/30" },
  { name: "Mobile App", desc: "React Native / Flutter", icon: Smartphone, color: "from-amber-400/20 to-orange-600/5", iconColor: "text-amber-400", border: "border-amber-400/30" },
];

export function HomeView() {
  const setView = useNexus((s) => s.setView);
  const setRoute = useNexus((s) => s.setRoute);
  const access = useNexus((s) => s.access);
  const [projects, setProjects] = useState<ProjectHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const resp = await fetch("/api/projects");
      if (!resp.ok) throw new Error("Failed to load");
      const data = await resp.json();
      setProjects(data.projects || []);
    } catch {
      toast.error("Không tải được lịch sử dự án");
    } finally {
      setLoading(false);
    }
  }

  function openProject(project: ProjectHistoryItem) {
    setRoute(project.id, project.leaderToken);
    setView("workspace");
    window.history.pushState({}, "", `/?p=${project.id}&token=${project.leaderToken}`);
  }

  function newProject() {
    setRoute(null, null);
    setView("input");
    window.history.pushState({}, "", `/`);
  }

  const heroProject = projects[heroIndex] || projects[0];
  const heroGradient = HERO_GRADIENTS[heroIndex % HERO_GRADIENTS.length];
  const filteredProjects = searchQuery.trim()
    ? projects.filter(p => p.topic.toLowerCase().includes(searchQuery.toLowerCase()) || p.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    : projects;
  const recentProjects = filteredProjects.slice(0, 10);

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }

  // Calculate overall stats
  const totalMembers = projects.reduce((sum, p) => sum + p.memberCount, 0);
  const totalTasks = projects.reduce((sum, p) => sum + p.taskCount, 0);
  const completedProjects = projects.filter(p => p.status === "INITIALIZED").length;
  const overallProgress = projects.length > 0 ? Math.round((completedProjects / projects.length) * 100) : 0;

  return (
    <main className="flex-1 flex flex-col bg-[#060b14]/95 min-h-screen nexus-boot">
      {/* ===== Top Bar with search + notifications + avatar ===== */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-[#060b14]/90 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-lg rounded-lg animate-pulse" />
              <div className="relative w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center nexus-flicker">
                <Cpu className="w-5 h-5 text-primary" />
              </div>
              <div className="absolute -inset-1 rounded-full border border-primary/20 nexus-orbit" style={{ borderTopColor: "transparent", borderBottomColor: "transparent" }} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-primary nexus-text-glow">NEXUS</span> AI
              </h1>
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Multi-Agent Architect</p>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex-1 max-w-md hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-card/40 border border-border/40 backdrop-blur-sm">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm dự án..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <kbd className="text-[9px] text-muted-foreground/50 font-mono px-1.5 py-0.5 rounded border border-border/40">⌘K</kbd>
          </div>

          {/* Right: notifications + new project + avatar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Notification bell */}
            <button className="relative w-9 h-9 rounded-lg bg-card/40 border border-border/40 flex items-center justify-center hover:border-primary/30 transition-colors">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
            </button>
            <Button onClick={newProject} className="bg-primary text-primary-foreground hover:bg-primary/90 nexus-glow">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Dự án mới</span>
            </Button>
            {/* User avatar */}
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-cyan-500/20 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
              {access?.name?.charAt(0).toUpperCase() || "U"}
            </div>
          </div>
        </div>
      </header>

      {/* ===== Body — 3 column layout ===== */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto flex gap-0 h-[calc(100vh-65px)]">

          {/* ===== Main Content (center) ===== */}
          <div className="flex-1 overflow-y-auto nexus-scroll">
            {loading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : projects.length === 0 ? (
              /* ===== Empty State with 3D AI Brain ===== */
              <div className="max-w-3xl mx-auto px-6 py-16 text-center nexus-boot">
                <div className="flex justify-center mb-8">
                  <AI3DBrain size={140} />
                </div>
                <h2 className="text-2xl font-bold mb-3 nexus-text-glow">Khởi tạo dự án với 10 AI Agent</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8">
                  Nhập chủ đề → 10 AI Agent tự động phân tích, thiết kế, lập sprint, sinh todolist, push GitHub và gửi email mời thành viên.
                </p>
                <Button onClick={newProject} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 nexus-glow-strong">
                  <Rocket className="w-5 h-5" /> Bắt đầu dự án đầu tiên
                </Button>
              </div>
            ) : (
              <>
                {/* ===== Hero with 3D AI brain ===== */}
                {heroProject && (
                  <div className="relative h-[300px] sm:h-[380px] overflow-hidden nexus-hud">
                    {/* Dynamic gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${heroGradient} transition-all duration-700`} />
                    {/* Grid pattern */}
                    <div className="absolute inset-0 nexus-grid-bg opacity-30 nexus-grid-pulse" />
                    {/* 3D AI Brain — right side */}
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex items-center justify-center">
                      <AI3DBrain size={180} />
                    </div>
                    <div className="absolute right-12 top-1/2 -translate-y-1/2 hidden sm:flex lg:hidden items-center justify-center">
                      <AI3DBrain size={120} />
                    </div>
                    {/* Floating glow orbs */}
                    <div className="absolute -top-20 -left-20 w-80 h-80 bg-primary/10 blur-[100px] rounded-full nexus-float" />
                    <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-cyan-500/8 blur-[100px] rounded-full nexus-float-slow" />
                    {/* Bottom fade */}
                    <div className="absolute inset-0 nexus-hero-gradient" />

                    {/* Content */}
                    <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-end pb-8">
                      <div className="max-w-2xl">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge className={`text-xs border-0 ${STATUS_LABELS[heroProject.status]?.color || STATUS_LABELS.DRAFT.color}`}>
                            {STATUS_LABELS[heroProject.status]?.text || heroProject.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground/60 font-mono">
                            Cập nhật {fmtDate(heroProject.updatedAt)}
                          </span>
                        </div>
                        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold mb-2 leading-tight tracking-tight nexus-text-glow">
                          {heroProject.topic}
                        </h1>
                        <p className="text-sm text-foreground/70 mb-5 max-w-xl line-clamp-2">
                          {heroProject.description?.substring(0, 120) || "Không có mô tả"}
                        </p>
                        {/* Stats */}
                        <div className="flex items-center gap-5 mb-5 text-sm">
                          <div className="flex items-center gap-1.5">
                            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                              <Users className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span className="font-semibold">{heroProject.memberCount}</span>
                            <span className="text-muted-foreground text-xs">thành viên</span>
                          </div>
                          {heroProject.taskCount > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                              </div>
                              <span className="font-semibold">{heroProject.taskCount}</span>
                              <span className="text-muted-foreground text-xs">tasks</span>
                            </div>
                          )}
                        </div>
                        {/* CTA */}
                        <div className="flex items-center gap-3">
                          <Button onClick={() => openProject(heroProject)} className="bg-primary text-primary-foreground hover:bg-primary/90 nexus-glow">
                            <Rocket className="w-4 h-4" /> Tiếp tục làm việc
                          </Button>
                          <Button onClick={newProject} variant="secondary" className="border-border/50 bg-card/50 backdrop-blur-sm">
                            <Plus className="w-4 h-4" /> Dự án mới
                          </Button>
                        </div>
                      </div>
                      {/* Hero dots */}
                      {projects.length > 1 && (
                        <div className="flex items-center gap-1.5 mt-6">
                          {projects.slice(0, 5).map((p, i) => (
                            <button
                              key={p.id}
                              onClick={() => setHeroIndex(i)}
                              className={`h-1.5 rounded-full transition-all ${
                                i === heroIndex ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                              }`}
                              title={p.topic}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ===== Rails ===== */}
                <div className="px-4 sm:px-6 py-8 space-y-10">
                  {/* Rail: Recent Projects */}
                  {recentProjects.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold">Dự án gần đây</h2>
                          <span className="text-xs text-muted-foreground/60 font-mono">({filteredProjects.length})</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {recentProjects.map((p, i) => {
                          const status = STATUS_LABELS[p.status] || STATUS_LABELS.DRAFT;
                          const gradient = CARD_GRADIENTS[i % CARD_GRADIENTS.length];
                          const borderColor = CARD_BORDER_COLORS[i % CARD_BORDER_COLORS.length];

                          return (
                            <div
                              key={p.id}
                              className={`nexus-card-hover rounded-2xl border ${borderColor} bg-card/50 backdrop-blur-xl overflow-hidden cursor-pointer group nexus-hud shadow-lg shadow-primary/5 hover:shadow-primary/20 transition-shadow`}
                              onClick={() => openProject(p)}
                            >
                              {/* Card header with gradient + project image */}
                              <div className={`h-24 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
                                <div className="absolute inset-0 nexus-grid-bg opacity-30" />
                                {/* Project bg image */}
                                <img
                                  src="/project-default-bg.png"
                                  alt=""
                                  className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                                {/* Status badge */}
                                <div className="absolute top-2.5 right-2.5">
                                  <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                                    {status.text}
                                  </span>
                                </div>
                                {/* Project icon */}
                                <div className="absolute bottom-2 left-3 w-8 h-8 rounded-lg bg-card/80 backdrop-blur-sm flex items-center justify-center">
                                  <FolderOpen className="w-4 h-4 text-primary" />
                                </div>
                              </div>
                              {/* Body */}
                              <div className="p-3.5">
                                <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{p.topic}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 min-h-[16px]">
                                  {p.description?.substring(0, 60) || "Không có mô tả"}
                                </p>
                                <div className="flex items-center gap-3 mt-2.5 text-[10px] text-muted-foreground">
                                  <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> {p.memberCount}</span>
                                  {p.taskCount > 0 && <span className="flex items-center gap-1"><CheckSquare className="w-2.5 h-2.5" /> {p.taskCount}</span>}
                                  <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {fmtDate(p.updatedAt)}</span>
                                </div>
                              </div>
                              {/* Progress bar */}
                              <div className="h-1.5 bg-border/30">
                                <div className={`h-full transition-all ${p.status === "INITIALIZED" ? "bg-emerald-400" : "bg-primary"}`} style={{ width: `${status.pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Templates */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-bold">Khởi tạo nhanh</h2>
                      <span className="text-xs text-muted-foreground/60">Chọn template để bắt đầu</span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {TEMPLATES.map((t) => {
                        const Icon = t.icon;
                        return (
                          <div
                            key={t.name}
                            className={`nexus-card-hover rounded-2xl border ${t.border} bg-gradient-to-br ${t.color} p-5 cursor-pointer group flex flex-col gap-3 nexus-hud backdrop-blur-xl shadow-lg shadow-primary/5 hover:shadow-primary/20 transition-shadow min-h-[140px]`}
                            onClick={newProject}
                          >
                            <div className="w-10 h-10 rounded-lg bg-card/60 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Icon className={`w-5 h-5 ${t.iconColor}`} />
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{t.name}</h3>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-auto">
                              <span>Bắt đầu</span>
                              <ArrowRight className="w-3 h-3" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ===== Right Sidebar — Project Overview ===== */}
          {!loading && projects.length > 0 && (
            <aside className="hidden lg:flex w-80 flex-col bg-[#080d18]/60 backdrop-blur-xl border-l border-border/30 p-4 overflow-y-auto nexus-scroll">
              {/* Overview stats */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Tổng quan</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-card/30 backdrop-blur-sm border border-border/20 p-3 shadow-sm text-center">
                    <div className="text-xl font-bold text-primary">{projects.length}</div>
                    <div className="text-[9px] text-muted-foreground">Dự án</div>
                  </div>
                  <div className="rounded-xl bg-card/30 backdrop-blur-sm border border-border/20 p-3 shadow-sm text-center">
                    <div className="text-xl font-bold text-cyan-400">{totalMembers}</div>
                    <div className="text-[9px] text-muted-foreground">Thành viên</div>
                  </div>
                  <div className="rounded-xl bg-card/30 backdrop-blur-sm border border-border/20 p-3 shadow-sm text-center">
                    <div className="text-xl font-bold text-emerald-400">{totalTasks}</div>
                    <div className="text-[9px] text-muted-foreground">Tasks</div>
                  </div>
                </div>
                {/* Overall progress */}
                <div className="mt-3 rounded-xl bg-card/30 backdrop-blur-sm border border-border/20 p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-muted-foreground">Tiến độ tổng thể</span>
                    <span className="text-xs font-bold text-primary">{overallProgress}%</span>
                  </div>
                  <div className="h-2.5 bg-border/40 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-primary to-cyan-400 transition-all" style={{ width: `${overallProgress}%` }} />
                  </div>
                </div>
              </div>

              {/* Recent activity */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Hoạt động gần đây</h3>
                <div className="space-y-2">
                  {projects.slice(0, 5).map((p, i) => {
                    const status = STATUS_LABELS[p.status] || STATUS_LABELS.DRAFT;
                    const AVATAR_COLORS = ["from-cyan-500/20 to-blue-600/10 text-cyan-400", "from-emerald-500/20 to-teal-600/10 text-emerald-400", "from-purple-500/20 to-indigo-600/10 text-purple-400", "from-amber-400/20 to-orange-600/10 text-amber-400", "from-rose-500/20 to-pink-600/10 text-rose-400"];
                    return (
                      <div key={p.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-card/30 hover:bg-card/50 cursor-pointer transition-colors" onClick={() => openProject(p)}>
                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-[10px] font-bold flex-shrink-0`}>
                          {p.topic.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium truncate">{p.topic}</p>
                          <p className="text-[9px] text-muted-foreground">{status.text} · {fmtDate(p.updatedAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick stats card */}
              <div className="mt-auto rounded-xl bg-gradient-to-br from-primary/10 to-cyan-500/5 border border-primary/20 p-4 nexus-hud">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-primary">NEXUS AI Status</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">AI Agents</span>
                    <span className="font-mono text-emerald-400">10/10 Online</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">API Keys</span>
                    <span className="font-mono text-primary">18 Active</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Pipeline</span>
                    <span className="font-mono text-cyan-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Ready
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
