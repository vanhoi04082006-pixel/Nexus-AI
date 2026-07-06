"use client";

import { notify } from "@/lib/notify";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNexus } from "@/store/useNexus";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Search,
  LayoutGrid,
  List,
  Star,
  Share2,
  Copy,
  Archive,
  FolderPlus,
  Play,
  CheckCircle2,
  Pause,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Pencil,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { AppSidebar } from "./AppSidebar";

// ===== Types =====
interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ProjectItem {
  id: string;
  topic: string;
  description: string;
  status: string;
  leaderName: string;
  leaderEmail: string;
  leaderToken: string;
  purpose: string;
  isFavorite: boolean;
  isArchived: boolean;
  priority: string;
  deadline: string | null;
  techStack: string[];
  tags: string[];
  coverColor: string;
  memberCount: number;
  taskCount: number;
  doneTaskCount: number;
  totalTaskCount: number;
  progress: number;
  hasAnalysis: boolean;
  members: ProjectMember[];
  createdAt: string;
  updatedAt: string;
}

type ViewMode = "grid" | "list";
type SortBy = "updated" | "created" | "name" | "name-desc" | "deadline" | "progress" | "members";
type StatusFilter = "all" | "planning" | "active" | "completed" | "paused" | "archived" | "overdue" | "favorite";

// ===== Constants =====
const STATUS_META: Record<string, { label: string; color: string; dot: string; icon: typeof Play }> = {
  planning: { label: "Planning", color: "text-amber-400 bg-amber-500/15 border-amber-500/30", dot: "bg-amber-400", icon: FolderPlus },
  active: { label: "Active", color: "text-primary bg-primary/15 border-primary/30", dot: "bg-primary", icon: Play },
  completed: { label: "Completed", color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", dot: "bg-emerald-400", icon: CheckCircle2 },
  paused: { label: "Paused", color: "text-slate-400 bg-slate-500/15 border-slate-500/30", dot: "bg-slate-400", icon: Pause },
  archived: { label: "Archived", color: "text-muted-foreground bg-muted/30 border-border", dot: "bg-muted-foreground", icon: Archive },
  overdue: { label: "Overdue", color: "text-red-400 bg-red-500/15 border-red-500/30", dot: "bg-red-400", icon: AlertTriangle },
};

const COVER_GRADIENTS: Record<string, string> = {
  cyan: "from-cyan-500/25 via-blue-600/10 to-transparent",
  emerald: "from-emerald-500/25 via-teal-600/10 to-transparent",
  purple: "from-purple-500/25 via-indigo-600/10 to-transparent",
  amber: "from-amber-500/25 via-orange-600/10 to-transparent",
  rose: "from-rose-500/25 via-pink-600/10 to-transparent",
  blue: "from-blue-500/25 via-cyan-600/10 to-transparent",
};

const COVER_PATTERNS: Record<string, string> = {
  cyan: "bg-[radial-gradient(circle_at_30%_50%,rgba(0,212,170,0.15),transparent_50%)]",
  emerald: "bg-[radial-gradient(circle_at_30%_50%,rgba(16,185,129,0.15),transparent_50%)]",
  purple: "bg-[radial-gradient(circle_at_30%_50%,rgba(168,85,247,0.15),transparent_50%)]",
  amber: "bg-[radial-gradient(circle_at_30%_50%,rgba(245,158,11,0.15),transparent_50%)]",
  rose: "bg-[radial-gradient(circle_at_30%_50%,rgba(244,63,94,0.15),transparent_50%)]",
  blue: "bg-[radial-gradient(circle_at_30%_50%,rgba(59,130,246,0.15),transparent_50%)]",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-slate-400",
  normal: "text-muted-foreground",
  high: "text-amber-400",
  urgent: "text-red-400",
};

const AVATAR_COLORS = [
  "from-cyan-500/30 to-blue-600/15 text-cyan-300",
  "from-emerald-500/30 to-teal-600/15 text-emerald-300",
  "from-purple-500/30 to-indigo-600/15 text-purple-300",
  "from-amber-400/30 to-orange-600/15 text-amber-300",
  "from-rose-500/30 to-pink-600/15 text-rose-300",
];

const TECH_CHIP_COLORS: Record<string, string> = {
  "Next.js": "bg-slate-700/40 text-slate-300 border-slate-600/30",
  React: "bg-cyan-700/30 text-cyan-300 border-cyan-600/30",
  "React Native": "bg-cyan-700/30 text-cyan-300 border-cyan-600/30",
  Flutter: "bg-blue-700/30 text-blue-300 border-blue-600/30",
  "Spring Boot": "bg-green-700/30 text-green-300 border-green-600/30",
  NestJS: "bg-red-700/30 text-red-300 border-red-600/30",
  Laravel: "bg-red-800/30 text-red-300 border-red-700/30",
  Docker: "bg-blue-800/30 text-blue-300 border-blue-700/30",
  PostgreSQL: "bg-blue-900/30 text-blue-300 border-blue-800/30",
  MongoDB: "bg-green-800/30 text-green-300 border-green-700/30",
  Redis: "bg-red-800/30 text-red-300 border-red-700/30",
  TypeScript: "bg-blue-700/30 text-blue-300 border-blue-600/30",
  Python: "bg-yellow-700/30 text-yellow-300 border-yellow-600/30",
  Java: "bg-orange-700/30 text-orange-300 border-orange-600/30",
};

const PAGE_SIZE = 9;

// ===== Helper: derive display status from DB status + deadline + archived =====
function deriveStatus(p: ProjectItem): string {
  if (p.isArchived) return "archived";
  if (p.status === "INITIALIZED") return "completed";
  if (p.status === "WORKSPACE" || p.status === "ANALYZING") {
    if (p.deadline && new Date(p.deadline) < new Date()) return "overdue";
    return "active";
  }
  if (p.status === "DRAFT") {
    if (p.deadline && new Date(p.deadline) < new Date()) return "overdue";
    return "planning";
  }
  return "planning";
}

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "vừa xong";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}p trước`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h trước`;
  if (diff < 7 * 86400000) return `${Math.floor(diff / 86400000)} ngày trước`;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function fmtDeadline(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return `Quá hạn ${Math.abs(diffDays)} ngày`;
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Ngày mai";
  if (diffDays < 7) return `${diffDays} ngày nữa`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần nữa`;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

// ===== Main Component =====
export function AllProjectsView() {
  const setView = useNexus((s) => s.setView);
  const setRoute = useNexus((s) => s.setRoute);

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search + Filter + Sort + View
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("updated");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [contextMenu, setContextMenu] = useState<{ projectId: string; x: number; y: number } | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [memberPopup, setMemberPopup] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load view mode preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("nexus_view_mode");
    if (saved === "grid" || saved === "list") setViewMode(saved);
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/projects");
      if (!resp.ok) throw new Error("Failed to load");
      const data = await resp.json();
      setProjects(data.projects || []);
    } catch {
      notify.error("Không tải được danh sách dự án");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [contextMenu]);

  function openProject(project: ProjectItem) {
    setRoute(project.id, project.leaderToken);
    setView("workspace");
    window.history.pushState({}, "", `/?p=${project.id}&token=${project.leaderToken}`);
  }

  function newProject() {
    setRoute(null, null);
    setView("input");
    window.history.pushState({}, "", `/`);
  }

  async function toggleFavorite(project: ProjectItem, e?: React.MouseEvent) {
    e?.stopPropagation();
    setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, isFavorite: !p.isFavorite } : p));
    try {
      await fetch(`/api/projects/${project.id}?token=${project.leaderToken}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !project.isFavorite }),
      });
    } catch {
      setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, isFavorite: project.isFavorite } : p));
      notify.error("Không thể cập nhật");
    }
  }

  async function toggleArchive(project: ProjectItem, e?: React.MouseEvent) {
    e?.stopPropagation();
    setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, isArchived: !p.isArchived } : p));
    try {
      await fetch(`/api/projects/${project.id}?token=${project.leaderToken}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !project.isArchived }),
      });
      notify.success(project.isArchived ? "Đã khôi phục dự án" : "Đã lưu trữ dự án");
    } catch {
      setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, isArchived: project.isArchived } : p));
      notify.error("Không thể cập nhật");
    }
  }

  async function deleteProject(project: ProjectItem, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!confirm(`Xóa vĩnh viễn "${project.topic}"?`)) return;
    try {
      await fetch(`/api/projects/${project.id}?token=${project.leaderToken}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      notify.success("Đã xóa dự án");
    } catch {
      notify.error("Xóa thất bại");
    }
  }

  async function duplicateProject(project: ProjectItem, e?: React.MouseEvent) {
    e?.stopPropagation();
    notify.loading("Đang sao chép dự án...", { id: "dup" });
    try {
      const resp = await fetch(`/api/projects/${project.id}/duplicate?token=${project.leaderToken}`, { method: "POST" });
      if (resp.ok) {
        notify.success("Đã sao chép dự án", { id: "dup" });
        loadProjects();
      } else {
        notify.error("Sao chép thất bại", { id: "dup" });
      }
    } catch {
      notify.error("Sao chép thất bại", { id: "dup" });
    }
  }

  function shareProject(project: ProjectItem, e?: React.MouseEvent) {
    e?.stopPropagation();
    const url = `${window.location.origin}/?p=${project.id}&token=${project.leaderToken}`;
    notify.copy(url, "Đã copy link chia sẻ!");
  }

  function startRename(project: ProjectItem, e?: React.MouseEvent) {
    e?.stopPropagation();
    setRenameId(project.id);
    setRenameValue(project.topic);
  }

  async function submitRename(project: ProjectItem) {
    if (!renameValue.trim()) {
      setRenameId(null);
      return;
    }
    setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, topic: renameValue.trim() } : p));
    try {
      await fetch(`/api/projects/${project.id}?token=${project.leaderToken}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: renameValue.trim() }),
      });
      notify.success("Đã đổi tên dự án");
    } catch {
      setProjects((prev) => prev.map((p) => p.id === project.id ? { ...p, topic: project.topic } : p));
      notify.error("Đổi tên thất bại");
    }
    setRenameId(null);
  }

  function handleContextMenu(e: React.MouseEvent, project: ProjectItem) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ projectId: project.id, x: e.clientX, y: e.clientY });
  }

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem("nexus_view_mode", mode);
  }

  // ===== Filter + Sort + Search (memoized) =====
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((p) =>
        p.topic.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.leaderName.toLowerCase().includes(q) ||
        p.members.some((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)) ||
        p.techStack.some((t) => t.toLowerCase().includes(q)) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Filter
    if (statusFilter !== "all") {
      if (statusFilter === "favorite") {
        result = result.filter((p) => p.isFavorite);
      } else if (statusFilter === "archived") {
        result = result.filter((p) => p.isArchived);
      } else {
        result = result.filter((p) => deriveStatus(p) === statusFilter);
      }
    }

    // Default: hide archived unless filter is "archived"
    if (statusFilter !== "archived") {
      result = result.filter((p) => !p.isArchived);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "created": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "updated": return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "name": return a.topic.localeCompare(b.topic);
        case "name-desc": return b.topic.localeCompare(a.topic);
        case "deadline": {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        case "progress": return b.progress - a.progress;
        case "members": return b.memberCount - a.memberCount;
        default: return 0;
      }
    });

    return result;
  }, [projects, debouncedSearch, statusFilter, sortBy]);

  // ===== Statistics =====
  const stats = useMemo(() => {
    const active = projects.filter((p) => !p.isArchived);
    return {
      total: active.length,
      planning: active.filter((p) => deriveStatus(p) === "planning").length,
      active: active.filter((p) => deriveStatus(p) === "active").length,
      completed: active.filter((p) => deriveStatus(p) === "completed").length,
      paused: active.filter((p) => deriveStatus(p) === "paused").length,
      overdue: active.filter((p) => deriveStatus(p) === "overdue").length,
    };
  }, [projects]);

  // ===== Pagination =====
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeProject = contextMenu ? projects.find((p) => p.id === contextMenu.projectId) : null;

  return (
    <main className="flex-1 flex flex-col bg-nexus-bg/95 min-h-screen nexus-boot">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-nexus-bg/90 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("home")} className="text-muted-foreground hover:text-primary transition-colors">
              <Cpu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold">Tất cả dự án</h1>
            <span className="text-xs text-muted-foreground/60">({filteredProjects.length})</span>
          </div>
          <Button onClick={newProject} className="bg-primary text-primary-foreground hover:bg-primary/90 nexus-glow">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Dự án mới</span>
          </Button>
        </div>
      </header>

      {/* ===== Body ===== */}
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar active="all-projects" />
        <div className="flex-1 overflow-y-auto nexus-scroll">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {/* ===== Statistics Overview ===== */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard icon={FolderOpen} label="Tổng dự án" value={stats.total} color="text-primary" bg="bg-primary/10" progress={100} />
              <StatCard icon={FolderPlus} label="Planning" value={stats.planning} color="text-amber-400" bg="bg-amber-500/10" progress={stats.total > 0 ? (stats.planning / stats.total) * 100 : 0} />
              <StatCard icon={Play} label="Đang hoạt động" value={stats.active} color="text-cyan-400" bg="bg-cyan-500/10" progress={stats.total > 0 ? (stats.active / stats.total) * 100 : 0} />
              <StatCard icon={CheckCircle2} label="Hoàn thành" value={stats.completed} color="text-emerald-400" bg="bg-emerald-500/10" progress={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} />
              <StatCard icon={Pause} label="Tạm dừng" value={stats.paused} color="text-slate-400" bg="bg-slate-500/10" progress={stats.total > 0 ? (stats.paused / stats.total) * 100 : 0} />
              <StatCard icon={AlertTriangle} label="Quá hạn" value={stats.overdue} color="text-red-400" bg="bg-red-500/10" progress={stats.total > 0 ? (stats.overdue / stats.total) * 100 : 0} />
            </div>

            {/* ===== Search + Filter + Sort + View Toggle ===== */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card/40 border border-border/50 backdrop-blur-md">
                <Search className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, mô tả, thành viên, tech stack, tag..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
                className="px-3 py-2.5 rounded-xl bg-card/40 border border-border/50 text-sm outline-none cursor-pointer hover:border-primary/30 transition-colors"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="planning">Planning</option>
                <option value="active">Đang hoạt động</option>
                <option value="completed">Hoàn thành</option>
                <option value="paused">Tạm dừng</option>
                <option value="overdue">Quá hạn</option>
                <option value="favorite">★ Yêu thích</option>
                <option value="archived">Lưu trữ</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-3 py-2.5 rounded-xl bg-card/40 border border-border/50 text-sm outline-none cursor-pointer hover:border-primary/30 transition-colors"
              >
                <option value="updated">Cập nhật mới nhất</option>
                <option value="created">Tạo mới nhất</option>
                <option value="name">Tên A-Z</option>
                <option value="name-desc">Tên Z-A</option>
                <option value="deadline">Deadline gần nhất</option>
                <option value="progress">Tiến độ cao nhất</option>
                <option value="members">Nhiều thành viên</option>
              </select>

              {/* View Toggle */}
              <div className="flex gap-1 p-1 rounded-xl bg-card/40 border border-border/50">
                <button
                  onClick={() => changeViewMode("grid")}
                  className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => changeViewMode("list")}
                  className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ===== Content ===== */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : filteredProjects.length === 0 ? (
              /* ===== Empty State ===== */
              <div className="text-center py-16">
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                  <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-cyan-500/10 border border-primary/30 flex items-center justify-center">
                    <FolderOpen className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <h2 className="text-xl font-bold mb-2">
                  {debouncedSearch || statusFilter !== "all" ? "Không tìm thấy dự án" : "Chưa có dự án nào"}
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  {debouncedSearch || statusFilter !== "all"
                    ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
                    : "Bắt đầu bằng cách tạo dự án đầu tiên. 10 AI Agent sẽ phân tích, thiết kế và lập kế hoạch cho bạn."}
                </p>
                {!debouncedSearch && statusFilter === "all" && (
                  <Button onClick={newProject} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 nexus-glow-strong">
                    <Sparkles className="w-5 h-5" /> Tạo dự án đầu tiên
                  </Button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              /* ===== Grid View ===== */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {paginatedProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onOpen={() => openProject(p)}
                    onFavorite={(e) => toggleFavorite(p, e)}
                    onShare={(e) => shareProject(p, e)}
                    onDuplicate={(e) => duplicateProject(p, e)}
                    onArchive={(e) => toggleArchive(p, e)}
                    onDelete={(e) => deleteProject(p, e)}
                    onRename={(e) => startRename(p, e)}
                    onContextMenu={(e) => handleContextMenu(e, p)}
                    renameMode={renameId === p.id}
                    renameValue={renameValue}
                    onRenameChange={setRenameValue}
                    onRenameSubmit={() => submitRename(p)}
                    onRenameCancel={() => setRenameId(null)}
                    memberPopup={memberPopup === p.id}
                    onToggleMemberPopup={() => setMemberPopup(memberPopup === p.id ? null : p.id)}
                  />
                ))}
              </div>
            ) : (
              /* ===== List View ===== */
              <div className="space-y-2">
                {paginatedProjects.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    onOpen={() => openProject(p)}
                    onFavorite={(e) => toggleFavorite(p, e)}
                    onShare={(e) => shareProject(p, e)}
                    onDuplicate={(e) => duplicateProject(p, e)}
                    onArchive={(e) => toggleArchive(p, e)}
                    onDelete={(e) => deleteProject(p, e)}
                    onContextMenu={(e) => handleContextMenu(e, p)}
                  />
                ))}
              </div>
            )}

            {/* ===== Pagination ===== */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-muted-foreground">
                  Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredProjects.length)} / {filteredProjects.length} dự án
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 rounded-lg bg-card/40 border border-border/40 flex items-center justify-center disabled:opacity-30 hover:bg-card/60 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-muted-foreground font-mono px-2">{currentPage} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 rounded-lg bg-card/40 border border-border/40 flex items-center justify-center disabled:opacity-30 hover:bg-card/60 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Context Menu (Right-Click) ===== */}
      {contextMenu && activeProject && (
        <div
          className="fixed z-[100] min-w-[180px] py-1.5 rounded-xl bg-[#080d18]/95 backdrop-blur-xl border border-border/60 shadow-2xl shadow-primary/10"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 250) }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuItem icon={ExternalLink} label="Mở" onClick={() => { openProject(activeProject); setContextMenu(null); }} />
          <ContextMenuItem icon={Pencil} label="Đổi tên" onClick={() => { startRename(activeProject); setContextMenu(null); }} />
          <ContextMenuItem icon={Copy} label="Sao chép" onClick={() => { duplicateProject(activeProject); setContextMenu(null); }} />
          <ContextMenuItem icon={Share2} label="Chia sẻ" onClick={() => { shareProject(activeProject); setContextMenu(null); }} />
          <div className="h-px bg-border/40 my-1" />
          <ContextMenuItem icon={Archive} label={activeProject.isArchived ? "Khôi phục" : "Lưu trữ"} onClick={() => { toggleArchive(activeProject); setContextMenu(null); }} />
          <ContextMenuItem icon={Trash2} label="Xóa" danger onClick={() => { deleteProject(activeProject); setContextMenu(null); }} />
        </div>
      )}
    </main>
  );
}

// ===== Stat Card =====
function StatCard({ icon: Icon, label, value, color, bg, progress }: {
  icon: typeof Play;
  label: string;
  value: number;
  color: string;
  bg: string;
  progress: number;
}) {
  return (
    <div className="group rounded-2xl bg-card/30 backdrop-blur-md border border-border/40 p-4 hover:border-primary/30 hover:bg-card/50 transition-all hover:-translate-y-0.5 cursor-default">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{label}</span>
      </div>
      <div className="flex items-end gap-1.5">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        {progress > 0 && progress < 100 && (
          <span className="text-[10px] text-muted-foreground/50 mb-1">{Math.round(progress)}%</span>
        )}
      </div>
      {/* Mini progress bar */}
      <div className="h-1 bg-border/40 rounded-full overflow-hidden mt-2">
        <div className={`h-full ${color.replace("text-", "bg-")} transition-all duration-500 group-hover:brightness-125`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

// ===== Project Card (Grid View) =====
function ProjectCard({
  project: p,
  onOpen,
  onFavorite,
  onShare,
  onDuplicate,
  onArchive,
  onDelete,
  onRename,
  onContextMenu,
  renameMode,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  memberPopup,
  onToggleMemberPopup,
}: {
  project: ProjectItem;
  onOpen: () => void;
  onFavorite: (e: React.MouseEvent) => void;
  onShare: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onRename: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  renameMode: boolean;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  memberPopup: boolean;
  onToggleMemberPopup: () => void;
}) {
  const status = deriveStatus(p);
  const statusMeta = STATUS_META[status] || STATUS_META.planning;
  const gradient = COVER_GRADIENTS[p.coverColor] || COVER_GRADIENTS.cyan;
  const pattern = COVER_PATTERNS[p.coverColor] || COVER_PATTERNS.cyan;
  const isOverdue = status === "overdue";

  return (
    <div
      className="group relative rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/20"
      onClick={onOpen}
      onContextMenu={onContextMenu}
    >
      {/* ===== Cover ===== */}
      <div className={`h-28 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
        <div className={`absolute inset-0 ${pattern}`} />
        <div className="absolute inset-0 nexus-grid-bg opacity-20" />
        {/* Favorite star */}
        <button
          onClick={onFavorite}
          className="absolute top-2.5 left-2.5 w-7 h-7 rounded-lg bg-card/60 backdrop-blur-md flex items-center justify-center hover:bg-card/90 transition-colors z-10"
        >
          <Star className={`w-3.5 h-3.5 ${p.isFavorite ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
        </button>
        {/* Status badge */}
        <div className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full border text-[9px] font-medium flex items-center gap-1 ${statusMeta.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot} ${status === "active" ? "animate-pulse" : ""}`} />
          {statusMeta.label}
        </div>
        {/* Priority indicator */}
        {p.priority !== "normal" && p.priority !== "low" && (
          <div className={`absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${PRIORITY_COLORS[p.priority] || ""} bg-black/40 backdrop-blur-sm`}>
            {p.priority}
          </div>
        )}
      </div>

      {/* ===== Body ===== */}
      <div className="p-4 space-y-3">
        {/* Title */}
        {renameMode ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={(e) => { if (e.key === "Enter") onRenameSubmit(); if (e.key === "Escape") onRenameCancel(); }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="w-full px-2 py-1 rounded-md bg-[#060b14] border border-primary text-sm font-semibold outline-none"
          />
        ) : (
          <div className="flex items-start gap-2">
            <h3 className="font-bold text-sm flex-1 truncate group-hover:text-primary transition-colors">{p.topic}</h3>
          </div>
        )}

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{p.description || "Không có mô tả"}</p>

        {/* Tech Stack Chips */}
        {p.techStack.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {p.techStack.slice(0, 4).map((tech) => (
              <span key={tech} className={`text-[9px] px-1.5 py-0.5 rounded-md border ${TECH_CHIP_COLORS[tech] || "bg-card/40 text-muted-foreground border-border/40"}`}>
                {tech}
              </span>
            ))}
            {p.techStack.length > 4 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-card/40 text-muted-foreground border border-border/40">
                +{p.techStack.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        {p.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {p.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[9px] text-primary/70">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground">Tiến độ</span>
            <span className={`text-[9px] font-mono font-bold ${isOverdue ? "text-red-400" : "text-primary"}`}>{p.progress}%</span>
          </div>
          <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${isOverdue ? "bg-red-400" : p.progress === 100 ? "bg-emerald-400" : "bg-gradient-to-r from-primary to-cyan-400"}`}
              style={{ width: `${p.progress}%` }}
            />
          </div>
          {p.totalTaskCount > 0 && (
            <div className="text-[9px] text-muted-foreground/60 mt-0.5">{p.doneTaskCount} / {p.totalTaskCount} task</div>
          )}
        </div>

        {/* Footer: Members + Deadline + Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          {/* Members */}
          <div className="flex items-center -space-x-2 relative">
            {p.members.slice(0, 4).map((m) => {
              const colorIdx = (m.name.charCodeAt(0) || 0) % AVATAR_COLORS.length;
              return (
                <div
                  key={m.id}
                  className={`w-6 h-6 rounded-full bg-gradient-to-br ${AVATAR_COLORS[colorIdx]} border-2 border-card flex items-center justify-center text-[9px] font-bold`}
                  title={m.name}
                >
                  {m.name.charAt(0).toUpperCase()}
                </div>
              );
            })}
            {p.memberCount > 4 && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleMemberPopup(); }}
                className="w-6 h-6 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                +{p.memberCount - 4}
              </button>
            )}
            {memberPopup && (
              <div
                className="absolute top-8 left-0 z-20 w-48 p-2 rounded-xl bg-[#080d18]/95 backdrop-blur-xl border border-border/60 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 px-1 pb-1.5 border-b border-border/30 mb-1">Thành viên ({p.memberCount})</p>
                <div className="max-h-40 overflow-y-auto nexus-scroll space-y-0.5">
                  {p.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 p-1 rounded hover:bg-card/40">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${AVATAR_COLORS[(m.name.charCodeAt(0) || 0) % AVATAR_COLORS.length]} flex items-center justify-center text-[8px] font-bold flex-shrink-0`}>
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] truncate">{m.name}</p>
                        {m.role && <p className="text-[8px] text-muted-foreground truncate">{m.role}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Deadline */}
          {p.deadline && (
            <div className={`flex items-center gap-1 text-[9px] ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
              <Calendar className="w-2.5 h-2.5" />
              {fmtDeadline(p.deadline)}
            </div>
          )}

          {/* Quick Actions (hover) */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onShare} className="w-6 h-6 rounded-md hover:bg-primary/15 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors" title="Chia sẻ">
              <Share2 className="w-3 h-3" />
            </button>
            <button onClick={onDuplicate} className="w-6 h-6 rounded-md hover:bg-primary/15 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors" title="Sao chép">
              <Copy className="w-3 h-3" />
            </button>
            <button onClick={onArchive} className="w-6 h-6 rounded-md hover:bg-primary/15 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors" title={p.isArchived ? "Khôi phục" : "Lưu trữ"}>
              <Archive className="w-3 h-3" />
            </button>
            <button onClick={onDelete} className="w-6 h-6 rounded-md hover:bg-destructive/15 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors" title="Xóa">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Last update */}
        <div className="flex items-center justify-between text-[9px] text-muted-foreground/50">
          <span>{p.leaderName}</span>
          <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {fmtRelative(p.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ===== Project Row (List View) =====
function ProjectRow({
  project: p,
  onOpen,
  onFavorite,
  onShare,
  onDuplicate,
  onArchive,
  onDelete,
  onContextMenu,
}: {
  project: ProjectItem;
  onOpen: () => void;
  onFavorite: (e: React.MouseEvent) => void;
  onShare: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const status = deriveStatus(p);
  const statusMeta = STATUS_META[status] || STATUS_META.planning;
  const isOverdue = status === "overdue";

  return (
    <div
      className="group flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card/30 backdrop-blur-md hover:border-primary/30 hover:bg-card/50 cursor-pointer transition-all"
      onClick={onOpen}
      onContextMenu={onContextMenu}
    >
      {/* Favorite */}
      <button onClick={onFavorite} className="flex-shrink-0">
        <Star className={`w-4 h-4 ${p.isFavorite ? "text-amber-400 fill-amber-400" : "text-muted-foreground/40 hover:text-amber-400"} transition-colors`} />
      </button>

      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full ${statusMeta.dot} flex-shrink-0 ${status === "active" ? "animate-pulse" : ""}`} />

      {/* Title + description */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">{p.topic}</h3>
        <p className="text-xs text-muted-foreground truncate">{p.description || "Không có mô tả"}</p>
      </div>

      {/* Tech stack (desktop only) */}
      <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
        {p.techStack.slice(0, 3).map((tech) => (
          <span key={tech} className={`text-[9px] px-1.5 py-0.5 rounded-md border ${TECH_CHIP_COLORS[tech] || "bg-card/40 text-muted-foreground border-border/40"}`}>
            {tech}
          </span>
        ))}
      </div>

      {/* Members */}
      <div className="hidden sm:flex items-center -space-x-2 flex-shrink-0">
        {p.members.slice(0, 3).map((m) => {
          const colorIdx = (m.name.charCodeAt(0) || 0) % AVATAR_COLORS.length;
          return (
            <div key={m.id} className={`w-6 h-6 rounded-full bg-gradient-to-br ${AVATAR_COLORS[colorIdx]} border-2 border-card flex items-center justify-center text-[9px] font-bold`} title={m.name}>
              {m.name.charAt(0).toUpperCase()}
            </div>
          );
        })}
        {p.memberCount > 3 && (
          <div className="w-6 h-6 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[9px] font-bold text-muted-foreground">
            +{p.memberCount - 3}
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="hidden md:block w-24 flex-shrink-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] font-mono text-muted-foreground">{p.progress}%</span>
        </div>
        <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
          <div className={`h-full ${isOverdue ? "bg-red-400" : p.progress === 100 ? "bg-emerald-400" : "bg-gradient-to-r from-primary to-cyan-400"}`} style={{ width: `${p.progress}%` }} />
        </div>
      </div>

      {/* Deadline */}
      {p.deadline && (
        <div className={`hidden md:flex items-center gap-1 text-[9px] flex-shrink-0 ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
          <Calendar className="w-2.5 h-2.5" />
          {fmtDeadline(p.deadline)}
        </div>
      )}

      {/* Updated */}
      <span className="hidden sm:block text-[9px] text-muted-foreground/50 flex-shrink-0 w-16 text-right">{fmtRelative(p.updatedAt)}</span>

      {/* Quick actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={onShare} className="w-7 h-7 rounded-md hover:bg-primary/15 flex items-center justify-center text-muted-foreground hover:text-primary" title="Chia sẻ">
          <Share2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDuplicate} className="w-7 h-7 rounded-md hover:bg-primary/15 flex items-center justify-center text-muted-foreground hover:text-primary" title="Sao chép">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={onArchive} className="w-7 h-7 rounded-md hover:bg-primary/15 flex items-center justify-center text-muted-foreground hover:text-primary" title={p.isArchived ? "Khôi phục" : "Lưu trữ"}>
          <Archive className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="w-7 h-7 rounded-md hover:bg-destructive/15 flex items-center justify-center text-muted-foreground hover:text-destructive" title="Xóa">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ===== Context Menu Item =====
function ContextMenuItem({ icon: Icon, label, onClick, danger }: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs hover:bg-card/60 transition-colors ${danger ? "text-destructive hover:bg-destructive/10" : "text-foreground"}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
