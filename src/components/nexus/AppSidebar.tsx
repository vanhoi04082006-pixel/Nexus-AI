"use client";

import { useState, useEffect } from "react";
import { useNexus } from "@/store/useNexus";
import { toast } from "sonner";
import {
  Activity,
  Plus,
  FolderOpen,
  Sparkles,
  Brain,
  Terminal,
  Zap,
  Settings,
  Cpu,
  X,
  LayoutDashboard,
} from "lucide-react";

export type AppView =
  | "input"
  | "workspace"
  | "home"
  | "all-projects"
  | "agent-hub"
  | "templates";

interface NavItemDef {
  id: AppView;
  label: string;
  icon: typeof Activity;
  group: "Tổng quan" | "Dự án" | "Công cụ" | "Cài đặt";
}

const NAV_ITEMS: NavItemDef[] = [
  { id: "home", label: "Tổng quan", icon: Activity, group: "Tổng quan" },
  { id: "all-projects", label: "Tất cả dự án", icon: FolderOpen, group: "Dự án" },
  { id: "input", label: "Tạo dự án mới", icon: Plus, group: "Dự án" },
  { id: "templates", label: "Templates", icon: Sparkles, group: "Dự án" },
  { id: "agent-hub", label: "Agent Hub", icon: Brain, group: "Công cụ" },
  { id: "workspace", label: "Knowledge Base", icon: Terminal, group: "Công cụ" },
  { id: "workspace", label: "Workflow", icon: Zap, group: "Công cụ" },
  { id: "workspace", label: "Cài đặt chung", icon: Settings, group: "Cài đặt" },
  { id: "workspace", label: "Tích hợp", icon: Cpu, group: "Cài đặt" },
];

const NAV_GROUPS: NavItemDef["group"][] = ["Tổng quan", "Dự án", "Công cụ", "Cài đặt"];

export function AppSidebar({ active }: { active: AppView }) {
  const setView = useNexus((s) => s.setView);
  const setRoute = useNexus((s) => s.setRoute);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  function newProject() {
    setRoute(null, null);
    setView("input");
    window.history.pushState({}, "", "/");
    setMobileOpen(false);
  }

  function navigate(view: AppView) {
    setMobileOpen(false);
    if (view === "templates") {
      // Go home, then scroll to templates section
      if (useNexus.getState().view !== "home") {
        setView("home");
        window.history.pushState({}, "", "/");
        setTimeout(() => {
          document.getElementById("templates-section")?.scrollIntoView({ behavior: "smooth" });
        }, 200);
      } else {
        document.getElementById("templates-section")?.scrollIntoView({ behavior: "smooth" });
      }
      toast.info("Đang chuyển đến Templates...");
      return;
    }
    if (view === "input") {
      newProject();
      return;
    }
    if (view === "workspace") {
      // Tools that aren't implemented yet -> just notify
      toast.info("Tính năng đang phát triển.");
      return;
    }
    setView(view as never);
    if (view !== "workspace") {
      window.history.pushState({}, "", "/");
    }
  }

  const navContent = (
    <div className="flex-1 space-y-5 overflow-y-auto nexus-scroll">
      {NAV_GROUPS.map((group) => {
        const items = NAV_ITEMS.filter((n) => n.group === group);
        return (
          <div key={group}>
            <div className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
              {group}
            </div>
            <div className="space-y-0.5">
              {items.map((item, idx) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <button
                    key={`${item.group}-${item.label}-${idx}`}
                    onClick={() => navigate(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all relative text-left ${
                      isActive
                        ? "bg-primary/12 text-primary"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
                    )}
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* ===== Desktop Sidebar (md+) ===== */}
      <aside className="hidden md:flex w-56 flex-col bg-nexus-surface/60 backdrop-blur-xl border-r border-border/30 py-4 px-3 flex-shrink-0">
        {navContent}
      </aside>

      {/* ===== Mobile Toggle Button ===== */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-lg bg-card/80 backdrop-blur-xl border border-border flex items-center justify-center hover:border-primary/40 transition-colors"
        aria-label="Mở menu điều hướng"
      >
        <LayoutDashboard className="w-5 h-5 text-primary" />
      </button>

      {/* ===== Mobile Drawer Overlay ===== */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[80vw] bg-nexus-surface/95 backdrop-blur-2xl border-r border-border/40 flex flex-col py-4 px-3 shadow-2xl shadow-primary/20 animate-in slide-in-from-left duration-200">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-3 pb-3 mb-2 border-b border-border/30">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight">
                    <span className="text-primary">NEXUS</span> AI
                  </h2>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Multi-Agent</p>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-secondary/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Đóng menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
