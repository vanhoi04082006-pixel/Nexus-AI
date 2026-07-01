"use client";

import { useEffect, useState } from "react";
import { useNexus } from "@/store/useNexus";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export function HomeView() {
  const setView = useNexus((s) => s.setView);
  const setRoute = useNexus((s) => s.setRoute);
  const [projects, setProjects] = useState<ProjectHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

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
    // Update URL so it's shareable
    window.history.pushState({}, "", `/?p=${project.id}&token=${project.leaderToken}`);
  }

  function newProject() {
    setRoute(null, null);
    setView("input");
    window.history.pushState({}, "", `/`);
  }

  return (
    <main className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-[#0c1322]/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-primary">NEXUS</span> AI
              </h1>
              <p className="text-xs text-muted-foreground">Multi-Agent Architect</p>
            </div>
          </div>
          <Button onClick={newProject} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Dự án mới
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto nexus-scroll">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-secondary/30 flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Chưa có dự án nào</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                Bắt đầu bằng cách tạo dự án đầu tiên. 8 AI Agent sẽ phân tích, thiết kế và lập kế hoạch cho bạn.
              </p>
              <Button onClick={newProject} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Tạo dự án đầu tiên
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Lịch sử dự án</h2>
                <span className="text-xs text-muted-foreground">{projects.length} dự án</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {projects.map((p) => (
                  <Card
                    key={p.id}
                    className="bg-card border-border hover:border-primary/40 transition-colors cursor-pointer group"
                    onClick={() => openProject(p)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                            {p.topic}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {p.description || "Không có mô tả"}
                          </p>
                        </div>
                        <Badge
                          className={`text-[9px] flex-shrink-0 ${
                            p.status === "INITIALIZED"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : p.status === "WORKSPACE"
                              ? "bg-primary/15 text-primary"
                              : "bg-amber-400/15 text-amber-400"
                          }`}
                        >
                          {p.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {p.memberCount}
                        </span>
                        {p.taskCount > 0 && (
                          <span className="flex items-center gap-1">
                            <CheckSquare className="w-3 h-3" /> {p.taskCount}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(p.updatedAt).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                        <span className="text-[10px] text-muted-foreground">
                          Nhóm trưởng: {p.leaderName}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="mt-6 text-center">
                <Button onClick={newProject} variant="secondary">
                  <Plus className="w-4 h-4" /> Tạo dự án mới
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
