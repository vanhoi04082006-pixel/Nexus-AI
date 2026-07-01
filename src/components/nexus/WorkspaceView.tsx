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

  const [initializing, setInitializing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

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
    try {
      // Start task generation in the background
      const resp = await fetch(`/api/projects/${projectId}/initialize?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${resp.status}`);
      }

      // Poll for completion
      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 120; // 5 min at 2.5s intervals
        const poll = async () => {
          attempts++;
          try {
            const pr = await fetch(`/api/projects/${projectId}/initialize/progress`);
            if (!pr.ok) {
              if (pr.status === 404) {
                // Progress expired or server restarted — check if tasks exist
                const projResp = await fetch(`/api/projects/${projectId}?token=${encodeURIComponent(token)}`);
                if (projResp.ok) {
                  const projData = await projResp.json();
                  if (projData.tasks && projData.tasks.length > 0) {
                    // Tasks were saved before crash — success
                    resolve();
                    return;
                  }
                }
                // No tasks yet — if we've polled enough, give up
                if (attempts > 5) {
                  reject(new Error("Khong the khoi tao todolist — server bi crash. Thu lai."));
                  return;
                }
                setTimeout(poll, 2500);
                return;
              }
              throw new Error(`HTTP ${pr.status}`);
            }
            const prog = (await pr.json()) as { status: string; error?: string };
            if (prog.status === "done") {
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

      toast.success("Todolist da duoc sinh ra! Email thong bao da gui thanh vien.");
      await loadProject();
      setActiveTab("tasks");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Loi khoi tao");
    } finally {
      setInitializing(false);
    }
  }

  function handleLogout() {
    setView("home");
    setRoute(null, null);
    window.history.pushState({}, "", "/");
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
    <main className="flex-1 flex flex-col md:flex-row min-h-screen">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center"
      >
        <Cpu className="w-5 h-5 text-primary" />
      </button>

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "flex" : "hidden"
        } md:flex w-full md:w-72 lg:w-80 flex-col bg-[#0c1322] border-r border-border z-40 md:z-0 fixed md:static inset-0 md:inset-auto`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold">
                <span className="text-primary">NEXUS</span> AI
              </h1>
              <p className="text-[11px] text-muted-foreground">Multi-Agent Architect</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto nexus-scroll px-3 py-4 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
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
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                        active
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{item.name}</span>
                      {item.id === "tasks" && taskCount > 0 && (
                        <Badge className="ml-auto bg-primary/20 text-primary text-[10px] px-1.5">
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
        <div className="px-3 py-4 border-t border-border space-y-2">
          {/* Public URL share box (leader only) */}
          {isLeader && publicUrl && !publicUrl.includes("localhost") && (
            <div className="px-2 py-2 rounded-lg bg-primary/[0.06] border border-primary/20">
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
                    toast.success("Da copy URL!");
                  }}
                  className="text-muted-foreground hover:text-primary p-1 rounded transition-colors flex-shrink-0"
                  title="Copy URL"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[9px] text-muted-foreground/70 mt-1">
                Chia se URL nay cho thanh vien (link email se dung URL nay)
              </p>
            </div>
          )}
          {isLeader && !hasTasks && (
            <Button
              onClick={handleInitialize}
              disabled={initializing}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {initializing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              {initializing ? "Dang sinh Todolist..." : "Khoi tao Du An"}
            </Button>
          )}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/30">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              {isLeader ? (
                <Crown className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{access?.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {isLeader ? "Nhom truong" : "Thanh vien"}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
              title="Thoat"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="border-b border-border bg-[#0c1322]/80 backdrop-blur-sm px-6 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate">{project.topic}</h2>
            <p className="text-xs text-muted-foreground">
              {isLeader ? "Ban la nhom truong · co the chinh sua" : "Ban la thanh vien · xem & thao luan"}
              {hasTasks && " · Du an da khoi tao"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isLeader && (
              <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
                <Crown className="w-3 h-3" /> Leader
              </Badge>
            )}
            <Badge variant="outline" className="text-muted-foreground">
              {project.status}
            </Badge>
          </div>
        </header>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto nexus-scroll">
          <div className="max-w-6xl mx-auto px-6 py-6 nexus-fade" key={activeTab}>
            {renderTab()}
          </div>
        </div>
      </div>
    </main>
  );
}
