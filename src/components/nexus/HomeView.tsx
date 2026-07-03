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

const STATUS_COLORS: Record<string, string> = {
  INITIALIZED: "from-emerald-500/20 to-emerald-600/5",
  WORKSPACE: "from-primary/20 to-primary/5",
  ANALYZING: "from-amber-400/20 to-amber-500/5",
  DRAFT: "from-slate-500/20 to-slate-600/5",
};

const TEMPLATES = [
  { name: "Fullstack Web App", desc: "Next.js + Prisma + shadcn/ui", icon: Rocket },
  { name: "E-commerce System", desc: "Shop + Payment + Inventory", icon: Network },
  { name: "Management System", desc: "CRM/ERP/HRM dashboard", icon: Cpu },
  { name: "Mobile App", desc: "React Native / Flutter", icon: Sparkles },
];

export function HomeView() {
  const setView = useNexus((s) => s.setView);
  const setRoute = useNexus((s) => s.setRoute);
  const [projects, setProjects] = useState<ProjectHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  async function deleteProject(id: string) {
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success("Da xoa du an");
    } catch {
      toast.error("Xoa that bai");
    }
    setDeleteId(null);
  }

  const heroProject = projects[0]; // Latest project for hero banner
  const recentProjects = projects.slice(0, 10);

  return (
    <main className="flex-1 flex flex-col bg-[#060b14] nexus-grid-bg">
      {/* ===== Top Bar ===== */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-[#060b14]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center nexus-pulse-glow">
              <Cpu className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-primary">NEXUS</span> AI
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
          /* ===== Empty State — Premium CTA ===== */
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
            {/* ===== Hero Banner (Netflix-style) ===== */}
            {heroProject && (
              <div className="relative h-[320px] sm:h-[400px] overflow-hidden">
                {/* Background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${STATUS_COLORS[heroProject.status] || STATUS_COLORS.DRAFT}`} />
                <div className="absolute inset-0 nexus-grid-bg opacity-50" />
                <div className="absolute inset-0 nexus-hero-gradient" />

                {/* Content */}
                <div className="relative h-full max-w-7xl mx-auto px-6 flex flex-col justify-end pb-10">
                  <Badge className={`mb-3 self-start text-xs ${
                    heroProject.status === "INITIALIZED" ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/20 text-primary"
                  }`}>
                    {heroProject.status}
                  </Badge>
                  <h1 className="text-2xl sm:text-4xl font-bold mb-2 max-w-2xl">{heroProject.topic}</h1>
                  <p className="text-sm text-muted-foreground mb-4 max-w-xl line-clamp-2">
                    {heroProject.description || "Không có mô tả"}
                  </p>
                  <div className="flex items-center gap-4 mb-5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {heroProject.memberCount} thành viên</span>
                    {heroProject.taskCount > 0 && (
                      <span className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5" /> {heroProject.taskCount} tasks</span>
                    )}
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(heroProject.updatedAt).toLocaleDateString("vi-VN")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button onClick={() => openProject(heroProject)} className="bg-primary text-primary-foreground hover:bg-primary/90 nexus-glow">
                      <Rocket className="w-4 h-4" /> Tiếp tục làm việc
                    </Button>
                    <Button onClick={newProject} variant="secondary" className="border-border">
                      <Plus className="w-4 h-4" /> Dự án mới
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Rails (Netflix-style horizontal scroll) ===== */}
            <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
              {/* Rail 1: Recent Projects */}
              {recentProjects.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold">Dự án gần đây</h2>
                    <span className="text-xs text-muted-foreground">{projects.length} tổng</span>
                  </div>
                  <div className="flex gap-4 overflow-x-auto nexus-rail pb-4 -mx-1 px-1">
                    {recentProjects.map((p) => (
                      <div
                        key={p.id}
                        className="nexus-card-hover flex-shrink-0 w-72 h-40 rounded-xl border border-border/60 bg-card overflow-hidden cursor-pointer group relative"
                        onClick={() => openProject(p)}
                      >
                        {/* Gradient header */}
                        <div className={`h-16 bg-gradient-to-br ${STATUS_COLORS[p.status] || STATUS_COLORS.DRAFT} relative overflow-hidden`}>
                          <div className="absolute inset-0 nexus-grid-bg opacity-30" />
                          <div className="absolute top-2 right-2">
                            <Badge className={`text-[9px] ${
                              p.status === "INITIALIZED" ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/20 text-primary"
                            }`}>
                              {p.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="p-3.5">
                          <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{p.topic}</h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.description || "Không có mô tả"}</p>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> {p.memberCount}</span>
                            {p.taskCount > 0 && <span className="flex items-center gap-1"><CheckSquare className="w-2.5 h-2.5" /> {p.taskCount}</span>}
                            <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {new Date(p.updatedAt).toLocaleDateString("vi-VN")}</span>
                          </div>
                        </div>

                        {/* Progress bar at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border/40">
                          <div
                            className={`h-full ${
                              p.status === "INITIALIZED" ? "bg-emerald-400" : "bg-primary"
                            }`}
                            style={{ width: p.status === "INITIALIZED" ? "100%" : p.status === "WORKSPACE" ? "60%" : "30%" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rail 2: Quick Templates */}
              <div>
                <h2 className="text-lg font-bold mb-4">Khởi tạo nhanh</h2>
                <div className="flex gap-4 overflow-x-auto nexus-rail pb-4 -mx-1 px-1">
                  {TEMPLATES.map((t) => {
                    const Icon = t.icon;
                    return (
                      <div
                        key={t.name}
                        className="nexus-card-hover flex-shrink-0 w-64 h-32 rounded-xl border border-border/60 bg-card p-4 cursor-pointer group flex flex-col justify-between"
                        onClick={newProject}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{t.name}</h3>
                            <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>Bắt đầu</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* All projects list (compact) */}
              {projects.length > 10 && (
                <div>
                  <h2 className="text-lg font-bold mb-4">Tất cả dự án</h2>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {projects.slice(10).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card/50 hover:border-primary/30 cursor-pointer group transition-colors"
                        onClick={() => openProject(p)}
                      >
                        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FolderOpen className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-medium truncate group-hover:text-primary transition-colors">{p.topic}</h3>
                          <p className="text-[10px] text-muted-foreground">{p.memberCount} members · {new Date(p.updatedAt).toLocaleDateString("vi-VN")}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
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
