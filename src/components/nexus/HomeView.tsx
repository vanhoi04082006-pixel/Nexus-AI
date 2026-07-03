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
  Network,
  Code2,
  ShoppingBag,
  Settings,
  Smartphone,
  Terminal,
} from "lucide-react";

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

// Dynamic gradient backdrops for hero — different per project
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

const STATUS_LABELS: Record<string, { text: string; color: string; pct: number }> = {
  INITIALIZED: { text: "Hoàn thành", color: "text-emerald-400 bg-emerald-500/15", pct: 100 },
  WORKSPACE: { text: "Đang làm việc", color: "text-primary bg-primary/15", pct: 60 },
  ANALYZING: { text: "Đang phân tích", color: "text-amber-400 bg-amber-500/15", pct: 30 },
  DRAFT: { text: "Bản nháp", color: "text-slate-400 bg-slate-500/15", pct: 10 },
};

const TEMPLATES = [
  { name: "Fullstack Web App", desc: "Next.js + Prisma + shadcn/ui", icon: Code2, color: "from-cyan-500/20 to-blue-600/5", iconColor: "text-cyan-400" },
  { name: "E-commerce System", desc: "Shop + Payment + Inventory", icon: ShoppingBag, color: "from-emerald-500/20 to-teal-600/5", iconColor: "text-emerald-400" },
  { name: "Management System", desc: "CRM / ERP / HRM dashboard", icon: Settings, color: "from-purple-500/20 to-indigo-600/5", iconColor: "text-purple-400" },
  { name: "Mobile App", desc: "React Native / Flutter", icon: Smartphone, color: "from-amber-400/20 to-orange-600/5", iconColor: "text-amber-400" },
];

export function HomeView() {
  const setView = useNexus((s) => s.setView);
  const setRoute = useNexus((s) => s.setRoute);
  const [projects, setProjects] = useState<ProjectHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

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
      toast.error("Khong tai duoc lich su du an");
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
  const recentProjects = projects.slice(0, 10);

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }

  return (
    <main className="flex-1 flex flex-col bg-[#060b14]/95 min-h-screen nexus-boot">
      {/* ===== Top Bar ===== */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-[#060b14]/90 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* AI Logo with orbital ring */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-lg rounded-lg animate-pulse" />
              <div className="relative w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center nexus-flicker">
                <Cpu className="w-5 h-5 text-primary" />
              </div>
              {/* Orbital ring */}
              <div className="absolute -inset-1 rounded-full border border-primary/20 nexus-orbit" style={{ borderTopColor: "transparent", borderBottomColor: "transparent" }} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-primary nexus-text-glow">NEXUS</span> AI
              </h1>
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Multi-Agent Architect</p>
            </div>
          </div>
          <Button onClick={newProject} className="bg-primary text-primary-foreground hover:bg-primary/90 nexus-glow">
            <Plus className="w-4 h-4" /> Dự án mới
          </Button>
        </div>
      </header>

      {/* ===== Body ===== */}
      <div className="flex-1 overflow-y-auto nexus-scroll">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          /* ===== Empty State ===== */
          <div className="max-w-3xl mx-auto px-6 py-20 text-center">
            <div className="relative inline-block mb-8">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
              <div className="relative w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto nexus-pulse-glow">
                <Sparkles className="w-10 h-10 text-primary nexus-spin-slow" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-3">Khởi tạo dự án với 10 AI Agent</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8">
              Nhập chủ đề → 10 AI Agent tự động phân tích, thiết kế, lập sprint, sinh todolist, push GitHub và gửi email mời thành viên.
            </p>
            <Button onClick={newProject} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 nexus-glow-strong">
              <Rocket className="w-5 h-5" /> Bắt đầu dự án đầu tiên
            </Button>
          </div>
        ) : (
          <>
            {/* ===== Hero Banner (Cinematic AI Command Center) ===== */}
            {heroProject && (
              <div className="relative h-[280px] sm:h-[360px] lg:h-[420px] overflow-hidden nexus-hud">
                {/* Dynamic gradient backdrop */}
                <div className={`absolute inset-0 bg-gradient-to-br ${heroGradient} transition-all duration-700`} />
                {/* Grid pattern overlay — breathing */}
                <div className="absolute inset-0 nexus-grid-bg opacity-40 nexus-grid-pulse" />
                {/* Glow orb top-left — floating */}
                <div className="absolute -top-20 -left-20 w-80 h-80 bg-primary/10 blur-[100px] rounded-full nexus-float" />
                {/* Glow orb bottom-right — floating slow */}
                <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-cyan-500/8 blur-[100px] rounded-full nexus-float-slow" />
                {/* Bottom fade to background */}
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

                    <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-2 leading-tight tracking-tight nexus-text-glow">
                      {heroProject.topic}
                    </h1>

                    <p className="text-sm text-muted-foreground mb-5 max-w-xl line-clamp-2">
                      {heroProject.description || "Không có mô tả"}
                    </p>

                    {/* Stats row */}
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
                      <div className="flex items-center gap-1.5">
                        <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <span className="font-semibold">{fmtDate(heroProject.updatedAt)}</span>
                      </div>
                    </div>

                    {/* CTA buttons */}
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => openProject(heroProject)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 nexus-glow"
                      >
                        <Rocket className="w-4 h-4" /> Tiếp tục làm việc
                      </Button>
                      <Button onClick={newProject} variant="secondary" className="border-border/50 bg-card/50 backdrop-blur-sm">
                        <Plus className="w-4 h-4" /> Dự án mới
                      </Button>
                    </div>
                  </div>

                  {/* Hero navigation dots — switch between recent projects */}
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

            {/* ===== Rails Section ===== */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">

              {/* Rail 1: Recent Projects */}
              {recentProjects.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold">Dự án gần đây</h2>
                      <span className="text-xs text-muted-foreground/60 font-mono">({projects.length})</span>
                    </div>
                  </div>

                  <div className="flex gap-4 overflow-x-auto nexus-rail pb-3 -mx-1 px-1">
                    {recentProjects.map((p, i) => {
                      const status = STATUS_LABELS[p.status] || STATUS_LABELS.DRAFT;
                      const gradient = CARD_GRADIENTS[i % CARD_GRADIENTS.length];

                      return (
                        <div
                          key={p.id}
                          className="nexus-card-hover flex-shrink-0 w-64 sm:w-72 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden cursor-pointer group"
                          onClick={() => openProject(p)}
                        >
                          {/* Card header with gradient */}
                          <div className={`h-20 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
                            <div className="absolute inset-0 nexus-grid-bg opacity-30" />
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

                          {/* Card body */}
                          <div className="p-3.5">
                            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{p.topic}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 min-h-[16px]">
                              {p.description?.substring(0, 60) || "Không có mô tả"}
                            </p>

                            {/* Stats */}
                            <div className="flex items-center gap-3 mt-2.5 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Users className="w-2.5 h-2.5" /> {p.memberCount}
                              </span>
                              {p.taskCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <CheckSquare className="w-2.5 h-2.5" /> {p.taskCount}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {fmtDate(p.updatedAt)}
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="h-1 bg-border/30">
                            <div
                              className={`h-full transition-all ${
                                p.status === "INITIALIZED" ? "bg-emerald-400" : "bg-primary"
                              }`}
                              style={{ width: `${status.pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rail 2: Quick Templates */}
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
                        className={`nexus-card-hover rounded-xl border border-border/40 bg-gradient-to-br ${t.color} p-4 cursor-pointer group flex flex-col gap-3`}
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

              {/* All projects (compact grid) */}
              {projects.length > 5 && (
                <div>
                  <h2 className="text-lg font-bold mb-4">Tất cả dự án</h2>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-card/40 hover:border-primary/30 cursor-pointer group transition-colors"
                        onClick={() => openProject(p)}
                      >
                        <div className={`w-8 h-8 rounded-md bg-gradient-to-br ${CARD_GRADIENTS[i % CARD_GRADIENTS.length]} flex items-center justify-center flex-shrink-0`}>
                          <FolderOpen className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-medium truncate group-hover:text-primary transition-colors">{p.topic}</h3>
                          <p className="text-[10px] text-muted-foreground">
                            {p.memberCount} members · {fmtDate(p.updatedAt)}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
