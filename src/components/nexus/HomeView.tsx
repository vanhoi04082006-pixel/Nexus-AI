"use client";

import { notify } from "@/lib/notify";
import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
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
  FolderPlus,
  FolderEdit,
  UserPlus,
  UserMinus,
  ListPlus,
  ListChecks,
  RefreshCw,
  Upload,
  Bot,
  AlertCircle,
  CalendarPlus,
  GitMerge,
  Github,
  FileEdit,
  Check,
  X,
  Send,
  Mail,
  ListTodo,
  Database,
  HardDrive,
  Boxes,
  Server,
} from "lucide-react";
import { AI3DBrain } from "./AI3DBrain";
import { AppSidebar } from "./AppSidebar";

// ===== Activity / Status / Task types =====
interface ActivityItem {
  id: string;
  type: string;
  status: string;
  title: string;
  details: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  actorAvatar: string;
  relatedTaskId: string | null;
  relatedTaskTitle: string;
  actionUrl: string;
  actionLabel: string;
  icon: string;
  projectId: string;
  projectTopic: string;
  createdAt: string;
}

interface SystemStatusData {
  agents: { total: number; online: number; offline: number; busy: number; idle: number; error: number };
  apiKeys: { total: number; active: number; expired: number; nearQuota: number; provider: string };
  pipeline: { status: string; currentAgent: string; progress: number; stage: string; projectTopic: string };
  database: { status: string; details: string };
  redis: { status: string; details: string };
  vectorDb: { status: string; details: string };
  storage: { status: string; details: string };
}

interface DashboardTask {
  id: string;
  title: string;
  assigneeName: string;
  memberName: string | null;
  memberEmail: string | null;
  role: string;
  priority: string;
  sprintName: string;
  layer: string;
  status: string;
  progress: number;
  deadline: string | null;
  isOverdue: boolean;
  isDueSoon: boolean;
  isAssignedToMe: boolean;
  projectId: string;
  projectTopic: string;
  token: string;
  createdAt: string;
  updatedAt: string;
}

// Map activity icon name → lucide component
const ICON_MAP: Record<string, typeof Activity> = {
  FolderPlus, FolderEdit, Trash2, UserPlus, UserMinus, ListPlus, ListChecks,
  RefreshCw, CheckSquare, Upload, Bot, AlertCircle, CalendarPlus, Rocket,
  GitMerge, Github, FileEdit, Check, X, Send, Mail, ListTodo, Cpu, Activity,
};

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
  { name: "Fullstack Web App", desc: "Next.js + Prisma + shadcn/ui", icon: Code2, color: "from-cyan-500/20 to-blue-600/5", iconColor: "text-cyan-400", border: "border-cyan-500/30",
    topic: "Hệ thống Fullstack Web App", description: "Ứng dụng web full-stack với Next.js, Prisma, shadcn/ui, JWT auth, dashboard", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, TypeScript, Tailwind CSS, Prisma, PostgreSQL, shadcn/ui, JWT, Docker", langPrefs: "TypeScript, SQL" },
  { name: "E-commerce System", desc: "Shop + Payment + Inventory", icon: ShoppingBag, color: "from-emerald-500/20 to-teal-600/5", iconColor: "text-emerald-400", border: "border-emerald-500/30",
    topic: "Hệ thống Thương mại Điện tử", description: "Sàn thương mại điện tử với quản lý sản phẩm, giỏ hàng, thanh toán, đơn hàng, đánh giá, kho hàng", purpose: "Sản phẩm thực tế",
    techPrefs: "Next.js, React, Stripe, Prisma, PostgreSQL, Redis, Tailwind CSS", langPrefs: "TypeScript, SQL" },
  { name: "Management System", desc: "CRM / ERP / HRM dashboard", icon: Settings, color: "from-purple-500/20 to-indigo-600/5", iconColor: "text-purple-400", border: "border-purple-500/30",
    topic: "Hệ thống Quản lý Doanh nghiệp", description: "Hệ thống quản lý CRM/ERP/HRM với dashboard, báo cáo, phân quyền, quản lý nhân sự", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Tailwind CSS, Chart.js, shadcn/ui", langPrefs: "TypeScript, SQL" },
  { name: "Hotel Management", desc: "Quản lý khách sạn đa chi nhánh", icon: Settings, color: "from-amber-400/20 to-orange-600/5", iconColor: "text-amber-400", border: "border-amber-400/30",
    topic: "Hệ thống Quản lý Khách sạn", description: "Quản lý đặt phòng, check-in/check-out, thanh toán, đa chi nhánh, báo cáo doanh thu", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Redis, Tailwind CSS, shadcn/ui", langPrefs: "TypeScript, SQL" },
  { name: "Learning Management", desc: "LMS / E-learning Platform", icon: Code2, color: "from-cyan-500/20 to-teal-600/5", iconColor: "text-cyan-300", border: "border-cyan-500/30",
    topic: "Hệ thống Quản lý Học trực tuyến", description: "LMS với khóa học, video, bài giảng, đăng ký học phần, theo dõi tiến độ, chứng chỉ", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Tailwind CSS, shadcn/ui, AWS S3", langPrefs: "TypeScript, SQL" },
  { name: "Mobile App", desc: "React Native / Flutter", icon: Smartphone, color: "from-amber-400/20 to-orange-600/5", iconColor: "text-amber-400", border: "border-amber-400/30",
    topic: "Ứng dụng Mobile", description: "Ứng dụng di động đa nền tảng với authentication, navigation, state management, API client", purpose: "Đồ án tốt nghiệp",
    techPrefs: "React Native, Expo, TypeScript, Tailwind CSS, Redux Toolkit", langPrefs: "TypeScript, JavaScript" },
  { name: "Hospital Management", desc: "Quản lý bệnh viện / phòng khám", icon: Settings, color: "from-rose-500/20 to-pink-600/5", iconColor: "text-rose-400", border: "border-rose-500/30",
    topic: "Hệ thống Quản lý Bệnh viện", description: "Quản lý bệnh nhân, bác sĩ, lịch hẹn, khám bệnh, toa thuốc, hóa viện, báo cáo y tế", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Tailwind CSS, shadcn/ui", langPrefs: "TypeScript, SQL" },
  { name: "Warehouse & Inventory", desc: "Quản lý kho bãi, nhập xuất", icon: ShoppingBag, color: "from-emerald-500/20 to-green-600/5", iconColor: "text-emerald-300", border: "border-emerald-500/30",
    topic: "Hệ thống Quản lý Kho bãi", description: "Quản lý nhập xuất tồn kho, sản phẩm, nhà cung cấp, đơn hàng, báo cáo tồn, cảnh báo hết hàng", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Redis, Tailwind CSS, shadcn/ui", langPrefs: "TypeScript, SQL" },
];

export function HomeView() {
  const setView = useNexus((s) => s.setView);
  const setRoute = useNexus((s) => s.setRoute);
  const access = useNexus((s) => s.access);
  const setInput = useNexus((s) => s.setInput);
  const [projects, setProjects] = useState<ProjectHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; type: string; title: string; desc: string; time: string; projectId?: string }[]>([]);
  // Dashboard widget state
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(null);
  const [dashboardTasks, setDashboardTasks] = useState<DashboardTask[]>([]);
  const [taskCounts, setTaskCounts] = useState({ total: 0, inProgress: 0, overdue: 0, dueSoon: 0, assignedToMe: 0 });
  const socketRef = useRef<Socket | null>(null);

  // FIX: Removed dead variable `userToken` (was declared but never used)

  // FIX: Use ref for projects to avoid infinite re-render loops.
  // Previous code had `useCallback(..., [projects])` + `useEffect(..., [projects, callbacks])`
  // → setProjects → projects change → callbacks recreated → effect re-runs → loadProjects → loop.
  const projectsRef = useRef<ProjectHistoryItem[]>([]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  const loadActivities = useCallback(async () => {
    try {
      const token = projectsRef.current[0]?.leaderToken;
      if (!token) return;
      const resp = await fetch(`/api/dashboard/activity?token=${encodeURIComponent(token)}&limit=15`);
      if (resp.ok) {
        const data = await resp.json();
        setActivities(data.activities || []);
      }
    } catch { /* ignore */ }
  }, []); // stable — reads projectsRef

  const loadSystemStatus = useCallback(async () => {
    try {
      const token = projectsRef.current[0]?.leaderToken;
      if (!token) return;
      const resp = await fetch(`/api/dashboard/status?token=${encodeURIComponent(token)}`);
      if (resp.ok) {
        const data = await resp.json();
        setSystemStatus(data);
      }
    } catch { /* ignore */ }
  }, []); // stable — reads projectsRef

  const loadDashboardTasks = useCallback(async () => {
    try {
      const token = projectsRef.current[0]?.leaderToken;
      if (!token) return;
      const resp = await fetch(`/api/dashboard/tasks?token=${encodeURIComponent(token)}&filter=all`);
      if (resp.ok) {
        const data = await resp.json();
        setDashboardTasks(data.tasks || []);
        setTaskCounts(data.counts || { total: 0, inProgress: 0, overdue: 0, dueSoon: 0, assignedToMe: 0 });
      }
    } catch { /* ignore */ }
  }, []); // stable — reads projectsRef

  // FIX: Load projects ONCE on mount (was [projects] → infinite loop)
  useEffect(() => {
    loadProjects();
  }, []); // empty deps — run once

  // FIX: Poll notifications every 30s — separate effect, stable deps
  useEffect(() => {
    loadNotifications();
    const notifInterval = setInterval(loadNotifications, 30000);
    return () => clearInterval(notifInterval);
  }, []); // empty deps — loadNotifications reads projectsRef

  // Load dashboard widgets ONCE when projects first become available
  // FIX: Use a ref flag to run only once, not on every projects change
  const widgetsLoadedRef = useRef(false);
  useEffect(() => {
    if (projects.length > 0 && !widgetsLoadedRef.current) {
      widgetsLoadedRef.current = true;
      loadActivities();
      loadSystemStatus();
      loadDashboardTasks();
    }
  }, [projects, loadActivities, loadSystemStatus, loadDashboardTasks]);

  // Realtime WebSocket for dashboard widgets (activity:new, task:update, status:update)
  // FIX: Use token from projectsRef (stable callbacks) — was reconnecting on every projects change
  useEffect(() => {
    const token = projectsRef.current[0]?.leaderToken;
    if (!token) return;
    const socket = io("/?XTransformPort=3002", { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("join", { dashboard: true, token });
    });
    socket.on("activity:new", () => {
      loadActivities();
    });
    socket.on("task:update", () => {
      loadDashboardTasks();
    });
    socket.on("status:update", () => {
      loadSystemStatus();
    });
    // Polling fallback (every 20s) in case WS misses an event
    const interval = setInterval(() => {
      loadActivities();
      loadDashboardTasks();
      loadSystemStatus();
    }, 20000);
    return () => {
      socket.disconnect();
      socketRef.current = null;
      clearInterval(interval);
    };
  }, [loadActivities, loadDashboardTasks, loadSystemStatus]); // stable callbacks

  async function loadNotifications() {
    try {
      // Fetch recent activity logs from all projects
      const notifs: { id: string; type: string; title: string; desc: string; time: string; projectId?: string }[] = [];
      for (const p of projects.slice(0, 5)) {
        try {
          const resp = await fetch(`/api/projects/${p.id}/history?token=${p.leaderToken}`);
          if (resp.ok) {
            const data = await resp.json();
            for (const log of (data.logs || []).slice(0, 3)) {
              notifs.push({
                id: log.id,
                type: log.type === "SECTION_EDIT" ? "PROPOSAL" : log.type === "INIT" ? "TASK_DONE" : "ACTIVITY",
                title: log.title,
                desc: log.details?.substring(0, 80) || "",
                time: new Date(log.createdAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
                projectId: p.id,
              });
            }
          }
        } catch { /* ignore individual project errors */ }
      }
      setNotifications(notifs.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 20));
    } catch { /* ignore */ }
  }

  async function loadProjects() {
    setLoading(true);
    setLoadError(false);
    try {
      const resp = await fetch("/api/projects");
      if (!resp.ok) throw new Error("Failed to load");
      const data = await resp.json();
      setProjects(data.projects || []);
    } catch {
      setLoadError(true);
      notify.error("Không tải được danh sách dự án — kiểm tra kết nối DB");
    } finally {
      setLoading(false);
    }
  }

  function openProject(project: ProjectHistoryItem) {
    setRoute(project.id, project.leaderToken);
    setView("workspace");
    window.history.pushState({}, "", `/?p=${project.id}&token=${project.leaderToken}`);
  }

  function openProjectById(projectId: string) {
    const p = projects.find((x) => x.id === projectId);
    if (p) openProject(p);
  }

  function newProject() {
    setRoute(null, null);
    setView("input");
    window.history.pushState({}, "", `/`);
  }

  function applyTemplate(template: typeof TEMPLATES[0]) {
    setInput({
      topic: template.topic,
      description: template.description,
      purpose: template.purpose,
      extraInfo: {
        requirements: "",
        specialReqs: "",
        techPrefs: template.techPrefs,
        langPrefs: template.langPrefs,
      },
    });
    setRoute(null, null);
    setView("input");
    window.history.pushState({}, "", `/`);
    notify.success(`Đã áp dụng template "${template.name}" — điền thông tin còn lại rồi bấm Khởi tạo`);
  }

  const heroProject = projects[heroIndex] || projects[0];
  const heroGradient = HERO_GRADIENTS[heroIndex % HERO_GRADIENTS.length];
  const filteredProjects = searchQuery.trim()
    ? projects.filter(p => p.topic.toLowerCase().includes(searchQuery.toLowerCase()) || p.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    : projects;
  const recentProjects = filteredProjects.slice(0, 6);

  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }

  function fmtActivityTime(iso: string): string {
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
    if (diffDays < 0) return `${Math.abs(diffDays)} ngày quá hạn`;
    if (diffDays === 0) return "Hôm nay";
    if (diffDays === 1) return "Ngày mai";
    if (diffDays < 7) return `${diffDays} ngày nữa`;
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  }

  // Pipeline status color mapping (text + dot)
  const PIPELINE_COLOR: Record<string, string> = {
    ready: "text-emerald-400",
    running: "text-cyan-400",
    paused: "text-amber-400",
    failed: "text-red-400",
    deploying: "text-purple-400",
    success: "text-emerald-400",
  };
  const PIPELINE_DOT: Record<string, string> = {
    ready: "bg-emerald-400",
    running: "bg-cyan-400",
    paused: "bg-amber-400",
    failed: "bg-red-400",
    deploying: "bg-purple-400",
    success: "bg-emerald-400",
  };

  // Calculate overall stats
  const totalMembers = projects.reduce((sum, p) => sum + p.memberCount, 0);
  const totalTasks = projects.reduce((sum, p) => sum + p.taskCount, 0);
  const completedProjects = projects.filter(p => p.status === "INITIALIZED").length;
  const overallProgress = projects.length > 0 ? Math.round((completedProjects / projects.length) * 100) : 0;

  return (
    <main className="flex-1 flex flex-col bg-nexus-bg/95 min-h-screen nexus-boot">
      {/* ===== Top Bar with search + notifications + avatar ===== */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-nexus-bg/90 backdrop-blur-2xl">
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
          <div className="flex-1 max-w-md hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card/40 border border-border/50 backdrop-blur-md">
            <Search className="w-4 h-4 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Tìm kiếm dự án, tasks, thành viên..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <kbd className="text-[9px] text-muted-foreground/50 font-mono px-1.5 py-0.5 rounded border border-border/40">⌘K</kbd>
          </div>

          {/* Right: theme toggle + notifications + new project + avatar */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Theme toggle */}
            {/* Notification bell with real data */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative w-9 h-9 rounded-lg bg-card/40 border border-border/50 flex items-center justify-center hover:border-primary/30 transition-colors"
              >
                <Bell className="w-4 h-4 text-muted-foreground" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[8px] font-bold text-primary-foreground flex items-center justify-center">
                    {notifications.length > 9 ? "9+" : notifications.length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-11 w-80 max-h-96 overflow-y-auto nexus-scroll rounded-2xl bg-nexus-surface/95 backdrop-blur-xl border border-border/60 shadow-2xl shadow-primary/10 p-2 z-50">
                  <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground/60 border-b border-border/30 mb-2">
                    Thông báo
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-3 py-8 text-center text-xs text-muted-foreground/60">
                      Không có thông báo mới
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((n) => (
                      <div key={n.id} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-card/40 transition-colors cursor-pointer" onClick={() => { if (n.projectId) openProjectById(n.projectId); setNotifOpen(false); }}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${n.type === "PROPOSAL" ? "bg-amber-500/15" : n.type === "TASK_DONE" ? "bg-emerald-500/15" : "bg-primary/15"}`}>
                          {n.type === "PROPOSAL" ? <Sparkles className="w-4 h-4 text-amber-400" /> : <CheckSquare className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{n.title}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-2">{n.desc}</p>
                          <p className="text-[9px] text-muted-foreground/50 mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
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

      {/* ===== Body — 3 column layout with left sidebar ===== */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-[calc(100vh-65px)]">

          {/* ===== Left Sidebar (shared across views) ===== */}
          <AppSidebar active="home" />

          {/* ===== Main Content (center) ===== */}
          <div className="flex-1 overflow-y-auto nexus-scroll">
            {loading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : loadError ? (
              /* ===== Error State ===== */
              <div className="max-w-3xl mx-auto px-6 py-16 text-center nexus-boot">
                <div className="flex justify-center mb-8">
                  <div className="w-20 h-20 rounded-2xl bg-destructive/15 flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-destructive" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-3">Không tải được dữ liệu</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                  Có thể database chưa được sync. Chạy lệnh <code className="px-1.5 py-0.5 rounded bg-card/60 text-primary font-mono text-xs">bun run db:push</code> để cập nhật schema, rồi refresh trang.
                </p>
                <Button onClick={loadProjects} variant="secondary" className="mr-2">
                  <RefreshCw className="w-4 h-4" /> Thử lại
                </Button>
                <Button onClick={newProject} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="w-4 h-4" /> Tạo dự án mới
                </Button>
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
                  <div className="relative h-[380px] sm:h-[460px] overflow-hidden nexus-hud">
                    {/* Dynamic gradient + radial */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${heroGradient} transition-all duration-700`} />
                    {/* Radial gradient overlay — light from top-left */}
                    <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 20% 30%, rgba(0,212,170,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(56,189,248,0.06) 0%, transparent 50%)" }} />
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
                          <span className="text-[10px] text-muted-foreground/80 font-mono">
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
                        <div className="flex items-center gap-5 mb-6 text-sm">
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
                            <span className="text-muted-foreground text-xs">deadline</span>
                          </div>
                        </div>
                        {/* CTA */}
                        <div className="flex items-center gap-3 mb-2">
                          <Button onClick={() => openProject(heroProject)} size="lg" className="bg-gradient-to-r from-primary to-cyan-400 text-primary-foreground hover:opacity-90 nexus-glow-strong rounded-2xl px-6 py-3 text-base shadow-[0_0_30px_rgba(0,212,170,0.3)]">
                            <Rocket className="w-5 h-5" /> Tiếp tục làm việc
                          </Button>
                          <Button onClick={newProject} variant="secondary" size="lg" className="border-border/60 bg-card/50 backdrop-blur-md rounded-2xl px-6 py-3 text-base">
                            <Plus className="w-5 h-5" /> Dự án mới
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
                              className={`nexus-card-hover rounded-2xl border border-border/40 ${borderColor} bg-card/50 backdrop-blur-xl overflow-hidden cursor-pointer group nexus-hud shadow-lg shadow-primary/5 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1.5 transition-all`}
                              onClick={() => openProject(p)}
                            >
                              {/* Card header with gradient + project image */}
                              <div className={`h-32 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
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
                                <div className={`h-full transition-all ${p.status === "INITIALIZED" ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-primary shadow-[0_0_8px_rgba(0,212,170,0.6)]"}`} style={{ width: `${status.pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Templates */}
                  <div id="templates-section">
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
                            onClick={() => applyTemplate(t)}
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
            <aside className="hidden lg:flex w-80 flex-col bg-nexus-surface/60 backdrop-blur-xl border-l border-border/30 p-4 overflow-y-auto nexus-scroll">
              {/* Overview stats */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Tổng quan</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-card/30 backdrop-blur-md border border-border/50 p-4 shadow-lg shadow-primary/5 text-center shadow-inner">
                    <div className="text-xl font-bold text-primary">{projects.length}</div>
                    <div className="text-[9px] text-muted-foreground">Dự án</div>
                  </div>
                  <div className="rounded-2xl bg-card/30 backdrop-blur-md border border-border/50 p-4 shadow-lg shadow-primary/5 text-center shadow-inner">
                    <div className="text-xl font-bold text-cyan-400">{totalMembers}</div>
                    <div className="text-[9px] text-muted-foreground">Thành viên</div>
                  </div>
                  <div className="rounded-2xl bg-card/30 backdrop-blur-md border border-border/50 p-4 shadow-lg shadow-primary/5 text-center shadow-inner">
                    <div className="text-xl font-bold text-emerald-400">{totalTasks}</div>
                    <div className="text-[9px] text-muted-foreground">Tasks</div>
                  </div>
                </div>
                {/* Overall progress */}
                <div className="mt-3 rounded-2xl bg-card/30 backdrop-blur-md border border-border/50 p-4 shadow-lg shadow-primary/5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-muted-foreground">Tiến độ tổng thể</span>
                    <span className="text-xs font-bold text-primary">{overallProgress}%</span>
                  </div>
                  <div className="h-2.5 bg-border/40 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-gradient-to-r from-primary to-cyan-400 transition-all shadow-[0_0_12px_rgba(0,212,170,0.5)]" style={{ width: `${overallProgress}%` }} />
                  </div>
                </div>
              </div>

              {/* Recent activity — REAL data from ActivityLog */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Hoạt động gần đây</h3>
                <div className="space-y-2 max-h-72 overflow-y-auto nexus-scroll">
                  {activities.length === 0 ? (
                    <div className="px-2 py-6 text-center">
                      <Activity className="w-6 h-6 text-muted-foreground/30 mx-auto mb-1.5" />
                      <p className="text-[10px] text-muted-foreground">Chưa có hoạt động</p>
                    </div>
                  ) : (
                    activities.map((a) => {
                      const Icon = ICON_MAP[a.icon] || Activity;
                      const AVATAR_COLORS = [
                        "from-cyan-500/30 to-blue-600/15 text-cyan-300",
                        "from-emerald-500/30 to-teal-600/15 text-emerald-300",
                        "from-purple-500/30 to-indigo-600/15 text-purple-300",
                        "from-amber-400/30 to-orange-600/15 text-amber-300",
                        "from-rose-500/30 to-pink-600/15 text-rose-300",
                      ];
                      const colorIdx = (a.actorName?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
                      const initial = (a.actorName || a.projectTopic || "?").charAt(0).toUpperCase();
                      return (
                        <div
                          key={a.id}
                          className="flex items-start gap-2.5 p-2 rounded-lg bg-card/30 hover:bg-card/50 cursor-pointer transition-colors"
                          onClick={() => {
                            if (a.actionUrl) {
                              const url = new URL(a.actionUrl, window.location.origin);
                              const pId = url.searchParams.get("p");
                              const pToken = url.searchParams.get("token");
                              if (pId && pToken) {
                                const proj = projects.find((p) => p.id === pId);
                                if (proj) openProject(proj);
                              }
                            } else {
                              const proj = projects.find((p) => p.id === a.projectId);
                              if (proj) openProject(proj);
                            }
                          }}
                        >
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${AVATAR_COLORS[colorIdx]} flex items-center justify-center text-[10px] font-bold flex-shrink-0`}>
                            {initial}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                              <Icon className={`w-3 h-3 flex-shrink-0 ${a.status === "FAILED" ? "text-red-400" : "text-primary"}`} />
                              <p className="text-[11px] font-medium truncate">{a.actorName || "Hệ thống"}</p>
                            </div>
                            <p className="text-[10px] text-foreground/80 line-clamp-2 leading-tight">{a.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {a.projectTopic && <span className="text-[9px] text-muted-foreground truncate">Dự án: {a.projectTopic}</span>}
                              <span className="text-[9px] text-muted-foreground/50 ml-auto flex-shrink-0">{fmtActivityTime(a.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* NEXUS AI Status — REAL system status */}
              <div className="mb-4 rounded-2xl bg-gradient-to-br from-primary/10 to-cyan-500/5 border border-border/50 p-4 nexus-hud backdrop-blur-md shadow-lg shadow-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-primary">NEXUS AI Status</span>
                </div>
                <div className="space-y-1.5">
                  {/* AI Agents */}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground flex items-center gap-1"><Bot className="w-2.5 h-2.5" /> AI Agents</span>
                    <span className="font-mono text-emerald-400">
                      {systemStatus ? `${systemStatus.agents.online + systemStatus.agents.busy}/${systemStatus.agents.total}` : "—"} Online
                    </span>
                  </div>
                  {systemStatus && systemStatus.agents.busy > 0 && (
                    <div className="flex items-center justify-between text-[9px] pl-4">
                      <span className="text-muted-foreground/60">└ Busy</span>
                      <span className="font-mono text-amber-400">{systemStatus.agents.busy}</span>
                    </div>
                  )}
                  {systemStatus && systemStatus.agents.error > 0 && (
                    <div className="flex items-center justify-between text-[9px] pl-4">
                      <span className="text-muted-foreground/60">└ Error</span>
                      <span className="font-mono text-red-400">{systemStatus.agents.error}</span>
                    </div>
                  )}
                  {/* API Keys */}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground flex items-center gap-1"><Zap className="w-2.5 h-2.5" /> API Keys</span>
                    <span className="font-mono text-primary">
                      {systemStatus ? `${systemStatus.apiKeys.active} Active` : "—"}
                    </span>
                  </div>
                  {systemStatus && systemStatus.apiKeys.nearQuota > 0 && (
                    <div className="flex items-center justify-between text-[9px] pl-4">
                      <span className="text-muted-foreground/60">└ Near quota</span>
                      <span className="font-mono text-amber-400">{systemStatus.apiKeys.nearQuota}</span>
                    </div>
                  )}
                  {/* Pipeline */}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground flex items-center gap-1"><Cpu className="w-2.5 h-2.5" /> Pipeline</span>
                    <span className={`font-mono flex items-center gap-1 ${PIPELINE_COLOR[systemStatus?.pipeline.status || "ready"] || "text-cyan-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${PIPELINE_DOT[systemStatus?.pipeline.status || "ready"] || "bg-emerald-400"} ${(systemStatus?.pipeline.status === "running" || systemStatus?.pipeline.status === "deploying") ? "animate-pulse" : ""}`} />
                      {systemStatus?.pipeline.status || "Ready"}
                    </span>
                  </div>
                  {systemStatus && systemStatus.pipeline.status === "running" && systemStatus.pipeline.currentAgent && (
                    <div className="text-[9px] text-muted-foreground/70 pl-4 truncate">└ {systemStatus.pipeline.currentAgent} ({systemStatus.pipeline.progress}%)</div>
                  )}
                  {/* Database */}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground flex items-center gap-1"><Database className="w-2.5 h-2.5" /> Database</span>
                    <span className={`font-mono ${systemStatus?.database.status === "connected" ? "text-emerald-400" : "text-red-400"}`}>
                      {systemStatus?.database.status || "—"}
                    </span>
                  </div>
                  {/* Redis */}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground flex items-center gap-1"><Server className="w-2.5 h-2.5" /> Redis</span>
                    <span className={`font-mono ${systemStatus?.redis.status === "connected" ? "text-emerald-400" : "text-muted-foreground/60"}`}>
                      {systemStatus?.redis.status || "—"}
                    </span>
                  </div>
                  {/* Storage */}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground flex items-center gap-1"><HardDrive className="w-2.5 h-2.5" /> Storage</span>
                    <span className={`font-mono ${systemStatus?.storage.status === "connected" ? "text-emerald-400" : "text-red-400"}`}>
                      {systemStatus?.storage.status || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tasks đang làm — REAL task data */}
              <div className="mt-auto rounded-2xl bg-card/30 backdrop-blur-md border border-border/50 p-4 shadow-lg shadow-primary/5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckSquare className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-primary">Tasks đang làm</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{taskCounts.total} total</span>
                </div>
                {/* Quick stats */}
                <div className="flex items-center gap-2 mb-3 text-[9px]">
                  {taskCounts.inProgress > 0 && <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400">{taskCounts.inProgress} doing</span>}
                  {taskCounts.dueSoon > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">{taskCounts.dueSoon} due soon</span>}
                  {taskCounts.overdue > 0 && <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">{taskCounts.overdue} overdue</span>}
                  {taskCounts.total === 0 && <span className="text-muted-foreground">Chưa có task</span>}
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto nexus-scroll">
                  {dashboardTasks.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-2">Không có task đang làm</p>
                  ) : (
                    dashboardTasks.slice(0, 6).map((t) => {
                      const proj = projects.find((p) => p.id === t.projectId);
                      return (
                        <div
                          key={t.id}
                          className="flex items-start gap-2 text-xs p-2 rounded-lg hover:bg-card/40 cursor-pointer transition-colors"
                          onClick={() => { if (proj) openProject(proj); }}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${t.status === "done" ? "bg-emerald-500/20 border-emerald-500/40" : t.isOverdue ? "border-red-500/40 bg-red-500/10" : "border-border/40"}`}>
                            {t.status === "done" && <CheckSquare className="w-2.5 h-2.5 text-emerald-400" />}
                            {t.isOverdue && t.status !== "done" && <Clock className="w-2.5 h-2.5 text-red-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate">{t.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[9px] text-muted-foreground">{t.memberName || t.assigneeName || "Unassigned"}</span>
                              {t.sprintName && <span className="text-[9px] text-muted-foreground/60">· {t.sprintName}</span>}
                              <span className={`text-[9px] font-mono ml-auto ${t.isOverdue ? "text-red-400" : t.isDueSoon ? "text-amber-400" : "text-muted-foreground/60"}`}>
                                {t.deadline ? fmtDeadline(t.deadline) : ""}
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="h-1 bg-border/40 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full transition-all ${t.status === "done" ? "bg-emerald-400" : t.isOverdue ? "bg-red-400" : "bg-primary"}`}
                                style={{ width: `${t.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
