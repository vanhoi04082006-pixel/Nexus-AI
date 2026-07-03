"use client";

import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useNexus } from "@/store/useNexus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CheckSquare,
  Clock,
  Loader2,
  CircleDot,
  CheckCircle2,
  Copy,
  FileCode,
  Terminal,
  X,
  Rocket,
  Loader2 as Spinner,
} from "lucide-react";
import { useReloadProject } from "../useReload";

const COLUMNS = [
  { id: "todo", title: "Can Lam", color: "#64748b" },
  { id: "in_progress", title: "Dang Lam", color: "#f59e0b" },
  { id: "review", title: "Can Review", color: "#38bdf8" },
  { id: "done", title: "Hoan Thanh", color: "#10b981" },
];

const LAYER_COLORS: Record<string, string> = {
  DATABASE: "#f59e0b",
  BACKEND: "#38bdf8",
  UI: "#a78bfa",
  CONFIG: "#64748b",
  TESTING: "#10b981",
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: "#ef4444",
  P1: "#f59e0b",
  P2: "#38bdf8",
};

interface TaskData {
  id: string;
  assigneeName: string;
  title: string;
  description: string;
  role: string;
  layer: string;
  targetFile: string;
  responsibilities: string;
  codeConventions: string;
  dependencies: string;
  acceptanceCriteria: string;
  implementationSteps: string;
  technicalHints: string;
  deadline: string | null;
  sprintName: string;
  status: string;
  hours: number;
  priority: string;
}

function parseArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((v) => String(v));
  if (typeof val === "string" && val.trim()) {
    return val.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function parseHints(val: unknown): { snippet?: string; note?: string } {
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return {}; }
  }
  if (val && typeof val === "object") return val as { snippet?: string; note?: string };
  return {};
}

export function TasksTab() {
  const tasks = useNexus((s) => s.tasks);
  const setTasks = useNexus((s) => s.setTasks);
  const updateTaskStatus = useNexus((s) => s.updateTaskStatus);
  const access = useNexus((s) => s.access);
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const reload = useReloadProject();
  const isLeader = access?.role === "leader";

  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  // Real-time polling
  useEffect(() => {
    if (!projectId || !token) return;
    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const resp = await fetch(`/api/projects/${projectId}/tasks?token=${encodeURIComponent(token)}`);
        if (!resp.ok || !active) return;
        const data = await resp.json();
        if (data.tasks && active) {
          const newJson = JSON.stringify(data.tasks.map((t: { id: string; status: string }) => ({ id: t.id, status: t.status })));
          const oldJson = JSON.stringify(tasks.map((t) => ({ id: t.id, status: t.status })));
          if (newJson !== oldJson) setTasks(data.tasks);
        }
      } catch { /* ignore */ }
    };
    const interval = setInterval(poll, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [projectId, token, tasks, setTasks]);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-secondary/30 flex items-center justify-center mx-auto mb-4">
          <CheckSquare className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Chua co todolist</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {isLeader
            ? 'Nhom truong nhan "Khoi tao Du An" o thanh ben de AI sinh todolist chi tiet cho tung thanh vien.'
            : "Nhom truong chua khoi tao todolist. Vui long doi."}
        </p>
      </div>
    );
  }

  const memberNames = Array.from(new Set(tasks.map((t) => t.assigneeName).filter(Boolean)));
  const filteredTasks = tasks.filter((t) => {
    if (showMyTasksOnly && access?.name && t.assigneeName !== access.name) return false;
    if (selectedMember !== "all" && t.assigneeName !== selectedMember) return false;
    return true;
  });

  const stats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    review: tasks.filter((t) => t.status === "review").length,
    todo: tasks.filter((t) => t.status === "todo").length,
  };
  const progressPct = Math.round((stats.done / stats.total) * 100);

  function canUpdate(task: TaskData): boolean {
    if (isLeader) return true;
    return access?.memberId === task.memberId || access?.name === task.assigneeName;
  }

  async function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const task = tasks.find((t) => t.id === draggableId);
    if (!task || !canUpdate(task)) {
      toast.error("Ban khong the cap nhat task nay");
      return;
    }

    const newStatus = destination.droppableId;
    updateTaskStatus(draggableId, newStatus);
    setUpdating(draggableId);
    try {
      const resp = await fetch(`/api/projects/${projectId}/tasks/${draggableId}?token=${encodeURIComponent(token || "")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!resp.ok) throw new Error("Loi cap nhat");
      toast.success(`Da chuyen sang: ${COLUMNS.find(c => c.id === newStatus)?.title}`);
    } catch {
      updateTaskStatus(draggableId, source.droppableId);
      toast.error("Khong cap nhat duoc");
    } finally {
      setUpdating(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Da sao chep code vao clipboard!");
  }

  return (
    <div className="space-y-4">
      {/* Progress overview */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <CheckSquare className="w-4 h-4 text-primary" /> Tien do tong the
            </h3>
            <span className="text-xl font-bold text-primary font-mono">{progressPct}%</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden mb-3">
            <div className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {COLUMNS.map((col) => (
              <div key={col.id} className="text-center">
                <div className="text-lg font-bold font-mono" style={{ color: col.color }}>
                  {stats[col.id as keyof typeof stats]}
                </div>
                <div className="text-[10px] text-muted-foreground">{col.title}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter toggle + member filter */}
      <div className="flex flex-wrap items-center gap-2">
        {!isLeader && access?.name && (
          <button
            onClick={() => setShowMyTasksOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showMyTasksOnly
                ? "bg-primary/15 border-primary text-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Viec cua toi
          </button>
        )}
        {/* Member filter dropdown */}
        <select
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-card text-foreground outline-none cursor-pointer hover:border-primary/50 transition-colors"
        >
          <option value="all">Tất cả thành viên ({tasks.length})</option>
          {memberNames.map((name) => {
            const count = tasks.filter((t) => t.assigneeName === name).length;
            return (
              <option key={name} value={name}>
                {name} ({count})
              </option>
            );
          })}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredTasks.length} / {tasks.length} tasks
        </span>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="bg-secondary/20 rounded-lg p-2.5 border border-border min-h-[300px] flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="font-semibold text-xs" style={{ color: col.color }}>{col.title}</h3>
                  <Badge variant="secondary" className="text-[10px]">{colTasks.length}</Badge>
                </div>
                <Droppable droppableId={col.id}>
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2 flex-1 min-h-[100px]"
                    >
                      {colTasks.map((task, index) => {
                        const t = task as unknown as TaskData;
                        const hints = parseHints(t.technicalHints);
                        const steps = parseArray(t.implementationSteps);
                        return (
                          <Draggable key={t.id} draggableId={t.id} index={index}>
                            {(prov) => (
                              <Card
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                onClick={() => setSelectedTask(t)}
                                className="bg-card border-border hover:border-primary/40 transition-colors cursor-pointer border-l-2"
                                style={{
                                  ...prov.draggableProps.style,
                                  borderLeftColor: LAYER_COLORS[t.layer] || "#475569",
                                }}
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono"
                                      style={{
                                        background: `${LAYER_COLORS[t.layer] || "#475569"}22`,
                                        color: LAYER_COLORS[t.layer] || "#475569",
                                      }}
                                    >
                                      {t.layer}
                                    </span>
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                                      style={{
                                        background: `${PRIORITY_COLORS[t.priority] || "#475569"}22`,
                                        color: PRIORITY_COLORS[t.priority] || "#475569",
                                      }}
                                    >
                                      {t.priority}
                                    </span>
                                    {updating === t.id && <Spinner className="w-3 h-3 animate-spin text-primary" />}
                                  </div>
                                  <h4 className="text-xs font-semibold line-clamp-2 mb-1">{t.title}</h4>
                                  <p className="text-[10px] text-muted-foreground line-clamp-1 mb-1.5">{t.description}</p>
                                  {t.targetFile && (
                                    <div className="flex items-center gap-1 text-[10px] text-primary font-mono truncate mb-1">
                                      <FileCode className="w-2.5 h-2.5 flex-shrink-0" />
                                      <span className="truncate">{t.targetFile}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span className="truncate">{t.assigneeName}</span>
                                    {t.deadline && (
                                      <span className="flex items-center gap-0.5 flex-shrink-0">
                                        <Clock className="w-2.5 h-2.5" />
                                        {new Date(t.deadline).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                                      </span>
                                    )}
                                  </div>
                                  {hints.snippet && (
                                    <div className="mt-1.5 flex items-center gap-1 text-[9px] text-emerald-400">
                                      <CodeIcon /> Co code snippet
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Task Detail Dialog */}
      {selectedTask && (
        <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto nexus-scroll bg-card border-border">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold font-mono"
                  style={{
                    background: `${LAYER_COLORS[selectedTask.layer] || "#475569"}22`,
                    color: LAYER_COLORS[selectedTask.layer] || "#475569",
                  }}
                >
                  {selectedTask.layer}
                </span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    background: `${PRIORITY_COLORS[selectedTask.priority] || "#475569"}22`,
                    color: PRIORITY_COLORS[selectedTask.priority] || "#475569",
                  }}
                >
                  {selectedTask.priority}
                </span>
                {selectedTask.targetFile && (
                  <Badge variant="outline" className="text-[10px] font-mono gap-1">
                    <FileCode className="w-2.5 h-2.5" /> {selectedTask.targetFile}
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-base">{selectedTask.title}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              {/* Assignee + deadline */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span><strong className="text-foreground">{selectedTask.assigneeName}</strong> — {selectedTask.role}</span>
                {selectedTask.deadline && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(selectedTask.deadline).toLocaleDateString("vi-VN")}
                  </span>
                )}
                <span>{selectedTask.hours}h</span>
                <span>{selectedTask.sprintName}</span>
              </div>

              {/* Description */}
              <div>
                <h4 className="font-semibold text-xs text-muted-foreground uppercase mb-1">Mo ta (Definition of Done)</h4>
                <p className="text-xs text-foreground/80 bg-secondary/30 rounded-lg p-3 leading-relaxed">{selectedTask.description}</p>
              </div>

              {/* Implementation steps */}
              {parseArray(selectedTask.implementationSteps).length > 0 && (
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase mb-1.5">Quy trinh trien khai</h4>
                  <div className="space-y-1 bg-secondary/20 rounded-lg p-3 border border-border">
                    {parseArray(selectedTask.implementationSteps).map((step, i) => (
                      <div key={i} className="text-xs flex gap-2">
                        <span className="text-primary font-bold">{i + 1}.</span>
                        <span className="text-foreground/80">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Code conventions */}
              {parseArray(selectedTask.codeConventions).length > 0 && (
                <div>
                  <h4 className="font-semibold text-xs text-primary uppercase mb-1.5">Quy uoc code (QUAN TRONG)</h4>
                  <div className="bg-primary/[0.06] border border-primary/20 rounded-lg p-3 space-y-1">
                    {parseArray(selectedTask.codeConventions).map((c, i) => (
                      <div key={i} className="text-xs font-mono text-foreground/90 flex gap-1.5">
                        <span className="text-primary">{'>'}</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical hints with code snippet */}
              {(() => {
                const hints = parseHints(selectedTask.technicalHints);
                if (!hints.snippet && !hints.note) return null;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="font-semibold text-xs text-muted-foreground uppercase">Goi y ky thuat & Code Snippet</h4>
                      {hints.snippet && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] gap-1"
                          onClick={() => copyToClipboard(hints.snippet!)}
                        >
                          <Copy className="w-2.5 h-2.5" /> Copy Code
                        </Button>
                      )}
                    </div>
                    {hints.snippet && (
                      <pre className="bg-[#060b14] text-foreground/80 p-3 rounded-lg text-[11px] font-mono overflow-x-auto nexus-scroll border border-border max-h-48">
                        <code>{hints.snippet}</code>
                      </pre>
                    )}
                    {hints.note && (
                      <p className="text-[11px] italic text-amber-400 mt-1.5">{hints.note}</p>
                    )}
                  </div>
                );
              })()}

              {/* Responsibilities */}
              {parseArray(selectedTask.responsibilities).length > 0 && (
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase mb-1.5">Trach nhiem</h4>
                  <ul className="space-y-1">
                    {parseArray(selectedTask.responsibilities).map((r, i) => (
                      <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                        <span className="text-primary mt-0.5">{'\u25B8'}</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Dependencies */}
              {selectedTask.dependencies && (
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase mb-1">Phu thuoc</h4>
                  <p className="text-xs text-foreground/80 bg-secondary/30 rounded p-2">{selectedTask.dependencies}</p>
                </div>
              )}

              {/* Acceptance criteria */}
              {parseArray(selectedTask.acceptanceCriteria).length > 0 && (
                <div>
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase mb-1.5">Tieu chi hoan thanh</h4>
                  <ul className="space-y-1">
                    {parseArray(selectedTask.acceptanceCriteria).map((a, i) => (
                      <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Status buttons */}
              {canUpdate(selectedTask) && (
                <div className="flex items-center gap-1.5 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">Trang thai:</span>
                  {COLUMNS.map((c) => (
                    <button
                      key={c.id}
                      onClick={async () => {
                        updateTaskStatus(selectedTask.id, c.id);
                        setSelectedTask({ ...selectedTask, status: c.id });
                        try {
                          await fetch(`/api/projects/${projectId}/tasks/${selectedTask.id}?token=${encodeURIComponent(token || "")}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: c.id }),
                          });
                          toast.success(`Da chuyen: ${c.title}`);
                        } catch {
                          toast.error("Loi cap nhat");
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                        selectedTask.status === c.id
                          ? "bg-primary/15 border-primary text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Small code icon
function CodeIcon() {
  return <span className="font-mono text-[9px]">{"</>"}</span>;
}
