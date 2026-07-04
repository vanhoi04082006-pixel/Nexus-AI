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
  Loader2,
  Search,
  Bell,
  LayoutGrid,
  List,
  Trash2,
  Copy,
  Star,
  Share2,
  Archive,
} from "lucide-react";
import { AI3DBrain } from "./AI3DBrain";
import { AppSidebar } from "./AppSidebar";

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

const STATUS_LABELS: Record<string, { text: string; color: string; pct: number }> = {
  INITIALIZED: { text: "Hoàn thành", color: "text-emerald-400 bg-emerald-500/15", pct: 100 },
  WORKSPACE: { text: "Đang làm việc", color: "text-primary bg-primary/15", pct: 60 },
  ANALYZING: { text: "Đang phân tích", color: "text-amber-400 bg-amber-500/15", pct: 30 },
  DRAFT: { text: "Bản nháp", color: "text-slate-400 bg-slate-500/15", pct: 10 },
};

export function AllProjectsView() {
  const setView = useNexus((s) => s.setView);
  const setRoute = useNexus((s) => s.setRoute);
  const setInput = useNexus((s) => s.setInput);
  const access = useNexus((s) => s.access);
  const [projects, setProjects] = useState<ProjectHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

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
      // Load favorites from localStorage
      const saved = localStorage.getItem("nexus_favorites");
      if (saved) setFavorites(new Set(JSON.parse(saved)));
    } catch {
      toast.error("Không tải được dự án");
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
    window.history.pushState({}, "", "/");
  }

  async function deleteProject(id: string) {
    if (!confirm("Xóa dự án vĩnh viễn?")) return;
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success("Đã xóa dự án");
    } catch {
      toast.error("Xóa thất bại");
    }
  }

  function duplicateProject(p: ProjectHistoryItem) {
    setInput({
      topic: `${p.topic} (bản sao)`,
      description: p.description,
      purpose: "",
      extraInfo: { requirements: [], specialReqs: "", techPrefs: [], langPrefs: [] },
      members: [],
      leaderName: "",
      leaderEmail: "",
    });
    setRoute(null, null);
    setView("input");
    toast.success("Đã sao chép thông tin dự án");
  }

  function toggleFavorite(id: string) {
    const newFav = new Set(favorites);
    if (newFav.has(id)) newFav.delete(id);
    else newFav.add(id);
    setFavorites(newFav);
    localStorage.setItem("nexus_favorites", JSON.stringify(Array.from(newFav)));
  }

  function shareProject(p: ProjectHistoryItem) {
    const url = `${window.location.origin}/?p=${p.id}&token=${p.leaderToken}`;
    navigator.clipboard.writeText(url);
    toast.success("Đã copy link chia sẻ!");
  }

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }

  // Filter + sort
  const filtered = projects
    .filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!p.topic.toLowerCase().includes(q) && !p.description?.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "updated") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (sortBy === "created") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "name") return a.topic.localeCompare(b.topic);
      if (sortBy === "members") return b.memberCount - a.memberCount;
      return 0;
    });

  return (
    <main className="flex-1 flex flex-col bg-nexus-bg/95 min-h-screen nexus-boot">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-nexus-bg/90 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("home")} className="text-muted-foreground hover:text-primary transition-colors">
              <Cpu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold">Tất cả dự án</h1>
            <span className="text-xs text-muted-foreground/60">({filtered.length})</span>
          </div>
          <Button onClick={newProject} className="bg-primary text-primary-foreground nexus-glow">
            <Plus className="w-4 h-4" /> Dự án mới
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <AppSidebar active="all-projects" />
        <div className="flex-1 overflow-y-auto nexus-scroll">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex-1 min-w-[200px] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/40 border border-border/50 backdrop-blur-md">
              <Search className="w-4 h-4 text-muted-foreground/60" />
              <input
                type="text"
                placeholder="Tìm kiếm dự án..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-card/40 border border-border/50 text-sm outline-none">
              <option value="all">Tất cả trạng thái</option>
              <option value="INITIALIZED">Hoàn thành</option>
              <option value="WORKSPACE">Đang làm việc</option>
              <option value="ANALYZING">Đang phân tích</option>
              <option value="DRAFT">Bản nháp</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 rounded-xl bg-card/40 border border-border/50 text-sm outline-none">
              <option value="updated">Cập nhật mới nhất</option>
              <option value="created">Tạo mới nhất</option>
              <option value="name">Tên A-Z</option>
              <option value="members">Thành viên</option>
            </select>
            <div className="flex gap-1 p-1 rounded-lg bg-card/40 border border-border/50">
              <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md ${viewMode === "grid" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md ${viewMode === "list" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Không tìm thấy dự án nào.</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((p, i) => {
                const status = STATUS_LABELS[p.status] || STATUS_LABELS.DRAFT;
                const isFav = favorites.has(p.id);
                return (
                  <div key={p.id} className="group rounded-2xl border border-border/40 bg-card/50 backdrop-blur-xl overflow-hidden shadow-lg shadow-primary/5 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1.5 transition-all nexus-hud">
                    <div className={`h-24 bg-gradient-to-br from-cyan-500/15 to-blue-900/5 relative overflow-hidden`}>
                      <div className="absolute inset-0 nexus-grid-bg opacity-30" />
                      <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                        <button onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }} className="w-7 h-7 rounded-md bg-card/60 backdrop-blur-sm flex items-center justify-center hover:bg-card/80 transition-colors">
                          <Star className={`w-3.5 h-3.5 ${isFav ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
                        </button>
                        <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>{status.text}</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{p.topic}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 min-h-[16px]">{p.description?.substring(0, 60) || "Không có mô tả"}</p>
                      <div className="flex items-center gap-3 mt-2.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-2.5 h-2.5" /> {p.memberCount}</span>
                        {p.taskCount > 0 && <span className="flex items-center gap-1"><CheckSquare className="w-2.5 h-2.5" /> {p.taskCount}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {fmtDate(p.updatedAt)}</span>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/30">
                        <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => openProject(p)}>Mở</Button>
                        <button onClick={() => duplicateProject(p)} className="p-1.5 rounded-md hover:bg-secondary/30 text-muted-foreground hover:text-primary transition-colors" title="Sao chép"><Copy className="w-3.5 h-3.5" /></button>
                        <button onClick={() => shareProject(p)} className="p-1.5 rounded-md hover:bg-secondary/30 text-muted-foreground hover:text-primary transition-colors" title="Chia sẻ"><Share2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteProject(p.id)} className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors ml-auto" title="Xóa"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="h-1.5 bg-border/30">
                      <div className={`h-full shadow-[0_0_8px_rgba(0,212,170,0.6)] ${p.status === "INITIALIZED" ? "bg-emerald-400" : "bg-primary"}`} style={{ width: `${status.pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => {
                const status = STATUS_LABELS[p.status] || STATUS_LABELS.DRAFT;
                const isFav = favorites.has(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card/50 backdrop-blur-xl hover:border-primary/30 cursor-pointer group transition-all" onClick={() => openProject(p)}>
                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }} className="flex-shrink-0">
                      <Star className={`w-4 h-4 ${isFav ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
                    </button>
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0"><FolderOpen className="w-4 h-4 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold truncate group-hover:text-primary transition-colors">{p.topic}</h3>
                      <p className="text-[10px] text-muted-foreground">{p.leaderName} · {p.memberCount} members · {p.taskCount} tasks · {fmtDate(p.updatedAt)}</p>
                    </div>
                    <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>{status.text}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); duplicateProject(p); }} className="p-1.5 rounded-md hover:bg-secondary/30 text-muted-foreground hover:text-primary"><Copy className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); shareProject(p); }} className="p-1.5 rounded-md hover:bg-secondary/30 text-muted-foreground hover:text-primary"><Share2 className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }} className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>
    </main>
  );
}
