"use client";

import { useState } from "react";
import { useNexus } from "@/store/useNexus";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CheckSquare,
  Clock,
  Loader2,
  CircleDot,
  CheckCircle2,
  User as UserIcon,
  Calendar,
  Link2,
  ClipboardCheck,
  Code2,
  AlertCircle,
  Hourglass,
} from "lucide-react";
import type { TaskItem } from "@/lib/types";

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: typeof Clock }
> = {
  todo: { label: "Chua lam", color: "text-muted-foreground", icon: Clock },
  in_progress: { label: "Dang lam", color: "text-amber-400", icon: Loader2 },
  review: { label: "Cho review", color: "text-sky-400", icon: CircleDot },
  done: { label: "Hoan thanh", color: "text-emerald-400", icon: CheckCircle2 },
};

const STATUS_ORDER = ["todo", "in_progress", "review", "done"];

/** Normalize a field that may be a string (newline-joined) or an array. */
function toArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((v) => String(v)).filter(Boolean);
  if (typeof val === "string" && val.trim()) {
    return val.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function TasksTab() {
  const tasks = useNexus((s) => s.tasks);
  const access = useNexus((s) => s.access);
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const updateTaskStatus = useNexus((s) => s.updateTaskStatus);
  const isLeader = access?.role === "leader";

  const [filterMember, setFilterMember] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-secondary/30 flex items-center justify-center mx-auto mb-4">
          <CheckSquare className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Chua co todolist</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {isLeader
            ? 'Nhom truong nhan "Khoi tao Du An" o thanh ben de AI sinh todolist chi tiet cho tung thanh vien, bao gom vai tro, quy uoc code, deadline va tieu chi hoan thanh.'
            : "Nhom truong chua khoi tao todolist. Vui long doi."}
        </p>
      </div>
    );
  }

  // Stats
  const stats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    review: tasks.filter((t) => t.status === "review").length,
    todo: tasks.filter((t) => t.status === "todo").length,
  };
  const progressPct = Math.round((stats.done / stats.total) * 100);

  // Members for filter
  const members = Array.from(new Set(tasks.map((t) => t.assigneeName)));

  // Apply filters
  let filtered = tasks;
  if (filterMember !== "all") filtered = filtered.filter((t) => t.assigneeName === filterMember);
  if (filterStatus !== "all") filtered = filtered.filter((t) => t.status === filterStatus);
  // Members can only see their own tasks + all tasks if leader
  if (!isLeader && access?.name) {
    // members see all but can only update their own — show all for context
  }

  async function updateStatus(taskId: string, status: string) {
    // Capture previous status for rollback on error
    const task = tasks.find((t) => t.id === taskId);
    const prevStatus = task?.status || "todo";

    // Optimistic update
    updateTaskStatus(taskId, status);
    try {
      const resp = await fetch(`/api/projects/${projectId}/tasks/${taskId}?token=${encodeURIComponent(token || "")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${resp.status}`);
      }
      toast.success("Da cap nhat trang thai task");
    } catch (err) {
      // Rollback to previous status
      updateTaskStatus(taskId, prevStatus);
      toast.error(err instanceof Error ? err.message : "Khong cap nhat duoc");
    }
  }

  function canUpdate(task: TaskItem): boolean {
    if (isLeader) return true;
    // Compare by memberId (more reliable than name)
    return access?.memberId === task.memberId || access?.name === task.assigneeName;
  }

  function daysLeft(deadline: string): { text: string; urgent: boolean } {
    if (!deadline) return { text: "", urgent: false };
    const d = new Date(deadline);
    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return { text: `Qua han ${Math.abs(diff)} ngay`, urgent: true };
    if (diff === 0) return { text: "Hom nay", urgent: true };
    if (diff === 1) return { text: "Ngay mai", urgent: true };
    return { text: `Con ${diff} ngay`, urgent: diff <= 3 };
  }

  // Group filtered tasks by assignee
  const grouped: Record<string, TaskItem[]> = {};
  for (const t of filtered) {
    if (!grouped[t.assigneeName]) grouped[t.assigneeName] = [];
    grouped[t.assigneeName].push(t);
  }

  return (
    <div className="space-y-5">
      {/* Progress overview */}
      <Card className="bg-card border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 text-base font-bold">
              <CheckSquare className="w-4 h-4 text-primary" /> Tong tien do
            </h3>
            <span className="text-2xl font-bold text-primary font-mono">{progressPct}%</span>
          </div>
          <div className="h-2.5 bg-border rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-muted-foreground font-mono">{stats.todo}</div>
              <div className="text-[10px] text-muted-foreground">Chua lam</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-400 font-mono">{stats.inProgress}</div>
              <div className="text-[10px] text-muted-foreground">Dang lam</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-sky-400 font-mono">{stats.review}</div>
              <div className="text-[10px] text-muted-foreground">Cho review</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-400 font-mono">{stats.done}</div>
              <div className="text-[10px] text-muted-foreground">Hoan thanh</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterMember} onValueChange={setFilterMember}>
          <SelectTrigger className="w-44 bg-card border-border text-sm">
            <SelectValue placeholder="Thanh vien" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tat ca thanh vien</SelectItem>
            {members.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-card border-border text-sm">
            <SelectValue placeholder="Trang thai" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tat ca trang thai</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} / {tasks.length} tasks
        </span>
      </div>

      {/* Tasks grouped by member */}
      {Object.entries(grouped).map(([memberName, memberTasks]) => {
        const memberDone = memberTasks.filter((t) => t.status === "done").length;
        const memberPct = Math.round((memberDone / memberTasks.length) * 100);
        return (
          <div key={memberName}>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                <UserIcon className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-bold">{memberName}</h3>
              <Badge variant="outline" className="text-[10px]">
                {memberDone}/{memberTasks.length} done
              </Badge>
              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden max-w-[120px]">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${memberPct}%` }}
                />
              </div>
              {access?.name === memberName && !isLeader && (
                <Badge className="bg-sky-400/15 text-sky-400 text-[9px]">Ban</Badge>
              )}
            </div>
            <div className="space-y-2.5">
              {memberTasks.map((task) => {
                const meta = STATUS_META[task.status] || STATUS_META.todo;
                const Icon = meta.icon;
                const dl = daysLeft(task.deadline);
                const isExpanded = expanded === task.id;
                const canEdit = canUpdate(task);
                return (
                  <Card
                    key={task.id}
                    className={`bg-card border-border ${
                      task.status === "done" ? "opacity-60" : ""
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => canEdit && updateStatus(task.id!, nextStatus(task.status))}
                          disabled={!canEdit}
                          className={`mt-0.5 flex-shrink-0 ${
                            canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                          }`}
                          title={canEdit ? "Click de chuyen trang thai" : "Ban khong the cap nhat task nay"}
                        >
                          {task.status === "done" ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : task.status === "in_progress" ? (
                            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                          ) : task.status === "review" ? (
                            <CircleDot className="w-5 h-5 text-sky-400" />
                          ) : (
                            <Clock className="w-5 h-5 text-muted-foreground" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`font-semibold text-sm ${
                                    task.status === "done" ? "line-through" : ""
                                  }`}
                                >
                                  {task.title}
                                </span>
                                <span className={`pri-${(task.priority || "P1").toLowerCase()}`}>
                                  {task.priority}
                                </span>
                                {task.sprintName && (
                                  <Badge variant="outline" className="text-[9px] text-muted-foreground">
                                    {task.sprintName}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Hourglass className="w-3 h-3" />
                                <span className="font-mono">{task.hours}h</span>
                              </div>
                              {dl.text && (
                                <div
                                  className={`flex items-center gap-1 text-[11px] ${
                                    dl.urgent ? "text-destructive" : "text-muted-foreground"
                                  }`}
                                >
                                  <Calendar className="w-3 h-3" />
                                  {dl.text}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Role */}
                          {task.role && (
                            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                              <UserIcon className="w-3 h-3" />
                              {task.role}
                            </div>
                          )}

                          {/* Expandable details */}
                          <button
                            onClick={() => setExpanded(isExpanded ? null : task.id || null)}
                            className="text-xs text-muted-foreground hover:text-primary mt-2 flex items-center gap-1"
                          >
                            {isExpanded ? "An chi tiet" : "Xem chi tiet (trach nhiem, quy uoc code, ...)"}
                          </button>

                          {isExpanded && (
                            <div className="mt-3 space-y-3 nexus-fade">
                              {/* Responsibilities */}
                              {toArray(task.responsibilities).length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                                    <ClipboardCheck className="w-3.5 h-3.5" /> Trach nhiem
                                  </div>
                                  <ul className="space-y-1">
                                    {toArray(task.responsibilities).map((r, i) => (
                                      <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                                        <span className="text-primary mt-0.5">▸</span>
                                        <span>{r}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Code conventions - emphasized */}
                              {toArray(task.codeConventions).length > 0 && (
                                <div className="bg-primary/[0.06] border border-primary/20 rounded-lg p-3">
                                  <div className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1">
                                    <Code2 className="w-3.5 h-3.5" /> Quy uoc code (DE DOC DE HIEU DE DONG BO)
                                  </div>
                                  <ul className="space-y-1">
                                    {toArray(task.codeConventions).map((c, i) => (
                                      <li
                                        key={i}
                                        className="text-xs text-foreground/90 flex items-start gap-1.5"
                                      >
                                        <span className="text-primary mt-0.5 font-mono">›</span>
                                        <span className="font-mono">{c}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Dependencies */}
                              {task.dependencies && (
                                <div>
                                  <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                                    <Link2 className="w-3.5 h-3.5" /> Phu thuoc
                                  </div>
                                  <p className="text-xs text-foreground/80">{task.dependencies}</p>
                                </div>
                              )}

                              {/* Acceptance criteria */}
                              {toArray(task.acceptanceCriteria).length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5" /> Tieu chi hoan thanh
                                  </div>
                                  <ul className="space-y-1">
                                    {toArray(task.acceptanceCriteria).map((a, i) => (
                                      <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                                        <span>{a}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Status selector */}
                              {canEdit && (
                                <div className="flex items-center gap-1.5 pt-1">
                                  <span className="text-xs text-muted-foreground">Trang thai:</span>
                                  {STATUS_ORDER.map((s) => {
                                    const sm = STATUS_META[s];
                                    const SIcon = sm.icon;
                                    return (
                                      <button
                                        key={s}
                                        onClick={() => updateStatus(task.id!, s)}
                                        className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                                          task.status === s
                                            ? `bg-${sm.color.includes("emerald") ? "emerald" : sm.color.includes("amber") ? "amber" : sm.color.includes("sky") ? "sky" : "secondary"}/15 border-current ${sm.color}`
                                            : "border-border text-muted-foreground hover:text-foreground"
                                        }`}
                                      >
                                        <SIcon className="w-2.5 h-2.5 inline mr-0.5" />
                                        {sm.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function nextStatus(current: string): string {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}
