"use client";

import { useEffect, useState } from "react";
import { useNexus } from "@/store/useNexus";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Cpu,
  Search,
  Users,
  CalendarCheck,
  Network,
  GitGraph,
  FileText,
  GitBranch,
  MessageSquare,
  UserPlus,
  CheckSquare,
  Mail,
  Rocket,
  RefreshCw,
  Loader2,
  Crown,
  LogOut,
  Globe,
  Copy,
  Trash2,
  History,
  Brain,
} from "lucide-react";
import { AnalysisTab } from "./tabs/AnalysisTab";
import { HRTab } from "./tabs/HRTab";
import { SprintTab } from "./tabs/SprintTab";
import { DesignTab } from "./tabs/DesignTab";
import { UMLTab } from "./tabs/UMLTab";
import { DocsTab } from "./tabs/DocsTab";
import { GitTab } from "./tabs/GitTab";
import { ChatTab } from "./tabs/ChatTab";
import { MembersTab } from "./tabs/MembersTab";
import { TasksTab } from "./tabs/TasksTab";
import { MailboxTab } from "./tabs/MailboxTab";
import { HistoryTab } from "./tabs/HistoryTab";
import { AgentHubTab } from "./tabs/AgentHubTab";
import { TaskProcessingOverlay } from "./TaskProcessingOverlay";
import { AI3DBrain } from "./AI3DBrain";
import { NotificationBell } from "./NotificationBell";

interface NavItem {
  id: string;
  name: string;
  icon: typeof Search;
  group: "analysis" | "collab" | "delivery";
}

const NAV: NavItem[] = [
  { id: "analysis", name: "Phan Tich Chu De", icon: Search, group: "analysis" },
  { id: "hr", name: "Phan Nhan Su", icon: Users, group: "analysis" },
  { id: "sprint", name: "Sprint Planning", icon: CalendarCheck, group: "analysis" },
  { id: "design", name: "Thiet Ke He Thong", icon: Network, group: "analysis" },
  { id: "uml", name: "UML Diagrams", icon: GitGraph, group: "analysis" },
  { id: "docs", name: "Tai Lieu", icon: FileText, group: "analysis" },
  { id: "git", name: "Git & Repo", icon: GitBranch, group: "analysis" },
  { id: "chat", name: "Thao Luan", icon: MessageSquare, group: "collab" },
  { id: "members", name: "Thanh Vien", icon: UserPlus, group: "collab" },
  { id: "tasks", name: "Todolist", icon: CheckSquare, group: "delivery" },
  { id: "mailbox", name: "Mailbox", icon: Mail, group: "delivery" },
  { id: "history", name: "Lich Su", icon: History, group: "delivery" },
  { id: "agenthub", name: "Agent Hub", icon: Brain, group: "delivery" },
];

export function WorkspaceView() {
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const access = useNexus((s) => s.access);
  const project = useNexus((s) => s.project);
  const result = useNexus((s) => s.result);
  const tasks = useNexus((s) => s.tasks);
  const activeTab = useNexus((s) => s.activeTab);
  const setActiveTab = useNexus((s) => s.setActiveTab);
  const setProject = useNexus((s) => s.setProject);
  const setResult = useNexus((s) => s.setResult);
  const setAccess = useNexus((s) => s.setAccess);
  const setMembers = useNexus((s) => s.setMembers);
  const setMessages = useNexus((s) => s.setMessages);
  const setTasks = useNexus((s) => s.setTasks);
  const setEmails = useNexus((s) => s.setEmails);
  const setProposals = useNexus((s) => s.setProposals);
  const loadingProject = useNexus((s) => s.loadingProject);
  const setLoadingProject = useNexus((s) => s.setLoadingProject);
  const setView = useNexus((s) => s.setView);
  const setRoute = useNexus((s) => s.setRoute);

  // Init overlay state (live log console during todolist generation)
  const initRunning = useNexus((s) => s.initRunning);
  const initLogs = useNexus((s) => s.initLogs);
  const initError = useNexus((s) => s.initError);
  const setInitRunning = useNexus((s) => s.setInitRunning);
  const setInitLogs = useNexus((s) => s.setInitLogs);
  const setInitError = useNexus((s) => s.setInitError);

  const [initializing, setInitializing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [initProgress, setInitProgress] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Fetch public URL (for share link in emails)
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.publicUrl) setPublicUrl(data.publicUrl);
      })
      .catch(() => {});
  }, []);

  const isLeader = access?.role === "leader";

  async function loadProject() {
    if (!projectId || !token) return;
    setLoadingProject(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}?token=${encodeURIComponent(token)}`);
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setAccess(data.access);
      setProject(data.project);
      setResult(data.result);
      setMembers(data.members || []);
      setMessages(data.chatMessages || data.messages || []);
      setTasks(data.tasks || []);
      setProposals(data.proposals || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Khong tai duoc du an");
    } finally {
      setLoadingProject(false);
    }
  }

  useEffect(() => {
    loadProject();
  }, [projectId, token]);

  async function handleInitialize() {
    if (!projectId || !token) return;
    setInitializing(true);
    setInitRunning(true);
    setInitLogs([]);
    setInitError(null);
    setInitProgress("Đang gửi yêu cầu sinh todolist...");
    try {
      const resp = await fetch(`/api/projects/${projectId}/initialize?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${resp.status}`);
      }
      setInitProgress("AI đang đọc phân tích dự án + nhân sự + sprint...");

      // Poll for completion with progress messages
      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 120;
        const messages = [
          "AI đang đọc phân tích dự án + nhân sự + sprint...",
          "AI đang phân chia công việc cho từng thành viên...",
          "AI đang viết quy ước code để các thành viên đồng bộ...",
          "AI đang gán deadline + độ ưu tiên cho từng task...",
          "AI đang kiểm tra tiêu chí hoàn thành + dependencies...",
          "Đang lưu todolist vào database...",
          "Đang gửi email thông báo task cho thành viên...",
        ];
        const poll = async () => {
          attempts++;
          // Update progress message every ~10s
          const msgIdx = Math.min(Math.floor(attempts / 4), messages.length - 1);
          setInitProgress(messages[msgIdx]);
          try {
            const pr = await fetch(`/api/projects/${projectId}/initialize/progress`);
            if (!pr.ok) {
              if (pr.status === 404) {
                const projResp = await fetch(`/api/projects/${projectId}?token=${encodeURIComponent(token)}`);
                if (projResp.ok) {
                  const projData = await projResp.json();
                  if (projData.tasks && projData.tasks.length > 0) {
                    setInitProgress(`Hoàn thành! ${projData.tasks.length} tasks đã tạo.`);
                    resolve();
                    return;
                  }
                }
                if (attempts > 5) {
                  reject(new Error("Khong the khoi tao todolist — server bi crash. Thu lai."));
                  return;
                }
                setTimeout(poll, 2500);
                return;
              }
              throw new Error(`HTTP ${pr.status}`);
            }
            const prog = (await pr.json()) as {
              status: string;
              error?: string;
              taskCount?: number;
              logs?: { id: string; ts: number; level: "info" | "success" | "warn" | "error"; agentId?: string; provider?: "openrouter" | "cache" | "fallback" | "pipeline"; model?: string; keyIndex?: number; message: string }[];
            };
            // Sync live logs into store
            if (prog.logs) {
              setInitLogs(prog.logs);
            }
            if (prog.status === "done") {
              setInitProgress(`Hoàn thành! ${prog.taskCount || ""} tasks đã tạo.`);
              resolve();
            } else if (prog.status === "error") {
              reject(new Error(prog.error || "Task generation that bai"));
            } else if (attempts >= maxAttempts) {
              reject(new Error("Timeout — task generation qua lau"));
            } else {
              setTimeout(poll, 2500);
            }
          } catch (err) {
            // Network error (server crashed) — retry
            if (attempts < 10) {
              setTimeout(poll, 3000);
            } else {
              reject(err instanceof Error ? err : new Error("Loi poll"));
            }
          }
        };
        setTimeout(poll, 1500);
      });

      // Reload project data to get fresh tasks
      await loadProject();
      setActiveTab("tasks");

      // Show detailed success notification
      const projResp = await fetch(`/api/projects/${projectId}/tasks?token=${encodeURIComponent(token)}`);
      if (projResp.ok) {
        const taskData = await projResp.json();
        const taskCount = taskData.tasks?.length || 0;
        const memberCount = new Set(taskData.tasks?.map((t: { assigneeName: string }) => t.assigneeName).filter(Boolean)).size;
        const p0Count = taskData.tasks?.filter((t: { priority: string }) => t.priority === "P0").length || 0;
        toast.success(
          `✅ Sinh todolist thành công!\n📊 ${taskCount} task cho ${memberCount} thành viên\n🔴 ${p0Count} task P0 (bat buoc)\n📧 Email thông báo đã gửi`,
          { duration: 8000 }
        );
      } else {
        toast.success("✅ Sinh todolist thành công! Email thông báo đã gửi thành viên.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi khởi tạo";
      setInitError(msg);
      toast.error(
        `❌ Sinh todolist thất bại!\n📋 Lý do: ${msg}\n🔧 Kiểm tra Live Log Console để xem chi tiết model nào fail`,
        { duration: 10000 }
      );
    } finally {
      setInitializing(false);
      setInitRunning(false);
    }
  }

  function handleLogout() {
    setView("home");
    setRoute(null, null);
    window.history.pushState({}, "", "/");
  }

  async function handleDeleteProject() {
    if (!projectId || !token) return;
    if (deleteConfirm !== "Delete") {
      toast.error('Phai nhap chinh xac "Delete" de xac nhan');
      return;
    }
    setDeleting(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${resp.status}`);
      }
      toast.success("Da xoa du an");
      setDeleteDialogOpen(false);
      setDeleteConfirm("");
      setView("home");
      setRoute(null, null);
      window.history.pushState({}, "", "/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Loi xoa du an");
    } finally {
      setDeleting(false);
    }
  }

  if (loadingProject || !project || !result) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm">Dang tai khong gian lam viec...</p>
        </div>
      </main>
    );
  }

  const taskCount = tasks.length;
  const hasTasks = taskCount > 0;

  const STATUS_LABELS: Record<string, { text: string }> = {
    INITIALIZED: { text: "Hoàn thành" },
    WORKSPACE: { text: "Đang làm việc" },
    ANALYZING: { text: "Đang phân tích" },
    DRAFT: { text: "Bản nháp" },
  };

  function renderTab() {
    switch (activeTab) {
      case "analysis":
        return <AnalysisTab />;
      case "hr":
        return <HRTab />;
      case "sprint":
        return <SprintTab />;
      case "design":
        return <DesignTab />;
      case "uml":
        return <UMLTab />;
      case "docs":
        return <DocsTab />;
      case "git":
        return <GitTab />;
      case "chat":
        return <ChatTab />;
      case "members":
        return <MembersTab />;
      case "tasks":
        return <TasksTab />;
      case "mailbox":
        return <MailboxTab />;
      case "history":
        return <HistoryTab />;
      case "agenthub":
        return <AgentHubTab />;
      default:
        return <AnalysisTab />;
    }
  }

  const navGroups: { label: string; items: NavItem[] }[] = [
    { label: "Phan Tich & Thiet Ke", items: NAV.filter((n) => n.group === "analysis") },
    { label: "Lam Viec Nhom", items: NAV.filter((n) => n.group === "collab") },
    { label: "Trien Khai", items: NAV.filter((n) => n.group === "delivery") },
  ];

  return (
    <main className="flex-1 flex flex-col md:flex-row min-h-screen bg-nexus-bg/95 nexus-grid-bg nexus-boot">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center backdrop-blur-xl"
      >
        <Cpu className="w-5 h-5 text-primary" />
      </button>

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "flex" : "hidden"
        } md:flex w-full md:w-64 lg:w-72 flex-col bg-nexus-surface/95 backdrop-blur-xl border-r border-border/40 z-40 md:z-0 fixed md:static inset-0 md:inset-auto`}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="scale-75 -ml-2">
              <AI3DBrain size={44} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">
                <span className="text-primary">NEXUS</span> AI
              </h1>
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Multi-Agent Architect</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto nexus-scroll px-2.5 py-4 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as typeof activeTab);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left group relative ${
                        active
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground"
                      }`}
                    >
                      {/* Active indicator bar */}
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
                      )}
                      <Icon className={`w-4 h-4 flex-shrink-0 transition-transform ${active ? "scale-110" : "group-hover:scale-105"}`} />
                      <span className="truncate">{item.name}</span>
                      {item.id === "tasks" && taskCount > 0 && (
                        <Badge className="ml-auto bg-primary/20 text-primary text-[10px] px-1.5 h-4 min-w-4 flex items-center justify-center">
                          {taskCount}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer: role + actions */}
        <div className="px-2.5 py-3 border-t border-border/40 space-y-2">
          {/* Public URL share box (leader only) */}
          {isLeader && publicUrl && !publicUrl.includes("localhost") && (
            <div className="px-3 py-2.5 rounded-lg bg-primary/[0.06] border border-primary/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Globe className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold text-primary">URL Public</span>
              </div>
              <div className="flex items-center gap-1">
                <code className="flex-1 text-[10px] text-muted-foreground truncate font-mono">
                  {publicUrl}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(publicUrl);
                    toast.success("Đã copy URL!");
                  }}
                  className="text-muted-foreground hover:text-primary p-1 rounded transition-colors flex-shrink-0"
                  title="Copy URL"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
          {isLeader && !hasTasks && (
            <Button
              onClick={handleInitialize}
              disabled={initializing}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 nexus-glow"
            >
              {initializing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              {initializing ? "Đang sinh Todolist..." : "Khởi tạo Dự Án"}
            </Button>
          )}
          {initializing && initProgress && (
            <div className="px-3 py-2 rounded-lg bg-primary/[0.06] border border-primary/20 nexus-shimmer">
              <p className="text-[11px] text-primary nexus-pulse">{initProgress}</p>
            </div>
          )}
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/20">
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
              {isLeader ? (
                <Crown className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{access?.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {isLeader ? "Nhóm trưởng" : "Thành viên"}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
              title="Thoát"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {isLeader && (
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-destructive/60 hover:text-destructive border border-destructive/15 hover:border-destructive/30 rounded-lg transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Xóa dự án
            </button>
          )}
        </div>
      </aside>

      {/* Delete confirmation dialog */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-destructive/30 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-destructive mb-2">Xóa dự án?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Hành động này không thể hoàn tác. Tất cả dữ liệu (phân tích, todolist, chat, email) sẽ bị xóa vĩnh viễn.
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Nhập <code className="text-destructive font-mono">Delete</code> để xác nhận:
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Delete"
              className="w-full px-3 py-2 mb-4 bg-nexus-surface-2 border border-border rounded-lg text-sm font-mono outline-none focus:border-destructive"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteConfirm("");
                }}
                disabled={deleting}
              >
                Hủy
              </Button>
              <Button
                onClick={handleDeleteProject}
                disabled={deleting || deleteConfirm !== "Delete"}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Xóa vĩnh viễn
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border/40 bg-nexus-bg/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0 flex items-center gap-3">
            {/* Active tab icon */}
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              {(() => {
                const activeNav = NAV.find(n => n.id === activeTab);
                const Icon = activeNav?.icon || Search;
                return <Icon className="w-4 h-4 text-primary" />;
              })()}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate">{project.topic}</h2>
              <p className="text-[10px] text-muted-foreground">
                {isLeader ? "Nhóm trưởng · có thể chỉnh sửa" : "Thành viên · xem & thảo luận"}
                {hasTasks && " · Dự án đã khởi tạo"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <NotificationBell />
            {isLeader && (
              <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 text-[10px]">
                <Crown className="w-2.5 h-2.5" /> Leader
              </Badge>
            )}
            <Badge variant="outline" className="text-muted-foreground text-[10px]">
              {STATUS_LABELS[project.status]?.text || project.status}
            </Badge>
          </div>
        </header>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto nexus-scroll">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 nexus-fade" key={activeTab}>
            {renderTab()}
          </div>
        </div>
      </div>

      {/* Live log console overlay during todolist generation */}
      {initializing && (
        <TaskProcessingOverlay
          mode="init"
          logs={initLogs}
          error={initError}
          progressMessage={initProgress}
        />
      )}
    </main>
  );
}
