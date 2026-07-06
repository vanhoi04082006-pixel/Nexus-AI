"use client";

import { notify } from "@/lib/notify";
import { useState, useEffect } from "react";
import { useNexus } from "@/store/useNexus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Cpu,
  FileCode,
  Mail,
  GitBranch,
  Eye,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ActivityLogEntry {
  id: string;
  type: string;
  status: string;
  title: string;
  details: string;
  agentId: string | null;
  model: string | null;
  duration: number | null;
  logCount: number | null;
  createdAt: string;
}

const TYPE_ICONS: Record<string, typeof History> = {
  PIPELINE: Cpu,
  INIT: RefreshCw,
  REFINE: RefreshCw,
  TASK_GEN: FileCode,
  SECTION_EDIT: FileCode,
  GITHUB_PUSH: GitBranch,
  EMAIL_SENT: Mail,
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle2; border: string }> = {
  SUCCESS: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    icon: CheckCircle2,
    border: "border-emerald-500/30",
  },
  FAILED: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    icon: XCircle,
    border: "border-rose-500/30",
  },
  RUNNING: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    icon: Clock,
    border: "border-amber-500/30",
  },
  WARNING: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    icon: AlertTriangle,
    border: "border-amber-500/30",
  },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}:${ss}`;
}

function fmtDuration(ms: number | null): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function HistoryTab() {
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [detailLog, setDetailLog] = useState<ActivityLogEntry | null>(null);

  async function loadHistory() {
    if (!projectId || !token) return;
    try {
      const resp = await fetch(`/api/projects/${projectId}/history?token=${encodeURIComponent(token)}`);
      if (resp.ok) {
        const data = await resp.json();
        setLogs(data.logs || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
    // Poll every 10s for new logs
    const interval = setInterval(loadHistory, 10000);
    return () => clearInterval(interval);
  }, [projectId, token]);

  const filteredLogs = filter === "all" ? logs : logs.filter((l) => l.type === filter);

  const stats = {
    total: logs.length,
    success: logs.filter((l) => l.status === "SUCCESS").length,
    failed: logs.filter((l) => l.status === "FAILED").length,
    warning: logs.filter((l) => l.status === "WARNING").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4 text-primary" />
            Lịch sử hoạt động
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="text-center p-2 rounded-lg bg-secondary/20">
              <div className="text-xl font-bold font-mono">{stats.total}</div>
              <div className="text-[10px] text-muted-foreground">Tổng</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-emerald-500/10">
              <div className="text-xl font-bold font-mono text-emerald-400">{stats.success}</div>
              <div className="text-[10px] text-muted-foreground">Thành công</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-rose-500/10">
              <div className="text-xl font-bold font-mono text-rose-400">{stats.failed}</div>
              <div className="text-[10px] text-muted-foreground">Thất bại</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-amber-500/10">
              <div className="text-xl font-bold font-mono text-amber-400">{stats.warning}</div>
              <div className="text-[10px] text-muted-foreground">Cảnh báo</div>
            </div>
          </div>

          {/* Filter buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                filter === "all"
                  ? "bg-primary/15 border-primary text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả ({stats.total})
            </button>
            {["PIPELINE", "INIT", "REFINE", "SECTION_EDIT", "GITHUB_PUSH", "EMAIL_SENT"].map((type) => {
              const count = logs.filter((l) => l.type === type).length;
              if (count === 0) return null;
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                    filter === type
                      ? "bg-primary/15 border-primary text-primary"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {type} ({count})
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Log entries */}
      {filteredLogs.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Chưa có hoạt động nào.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Tạo dự án, sinh todolist, hoặc AI Refine để xem lịch sử tại đây.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto nexus-scroll">
          {filteredLogs.map((log) => {
            const style = STATUS_STYLES[log.status] || STATUS_STYLES.WARNING;
            const StatusIcon = style.icon;
            const TypeIcon = TYPE_ICONS[log.type] || History;

            return (
              <Card key={log.id} className={`bg-card border-border ${style.border}`}>
                <CardContent className="p-4">
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${style.bg}`}>
                      <StatusIcon className={`w-5 h-5 ${style.text}`} />
                    </div>

                    {/* Title + details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{log.title}</span>
                        <Badge variant="outline" className={`text-[10px] ${style.text} ${style.border} ${style.bg}`}>
                          {log.status}
                        </Badge>
                        {log.type && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            <TypeIcon className="w-2.5 h-2.5 mr-1" />
                            {log.type}
                          </Badge>
                        )}
                        {log.agentId && (
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/10">
                            {log.agentId}
                          </Badge>
                        )}
                      </div>

                      {/* Details */}
                      {log.details && (
                        <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                          {log.details}
                        </div>
                      )}

                      {/* Meta */}
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground/70 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {fmtDate(log.createdAt)}
                        </span>
                        {log.model && (
                          <span className="flex items-center gap-1">
                            <Cpu className="w-2.5 h-2.5" />
                            {log.model.length > 30 ? log.model.substring(0, 28) + "…" : log.model}
                          </span>
                        )}
                        {log.duration && (
                          <span>⏱ {fmtDuration(log.duration)}</span>
                        )}
                        {log.logCount != null && log.logCount > 0 && (
                          <span>📝 {log.logCount} logs</span>
                        )}
                      </div>

                      {/* View detail button */}
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-2 text-muted-foreground hover:text-primary"
                          onClick={() => setDetailLog(log)}
                        >
                          <Eye className="w-3 h-3 mr-1" /> Xem chi tiết
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Modal — xem toàn bộ log chi tiết */}
      <Dialog open={!!detailLog} onOpenChange={(o) => !o && setDetailLog(null)}>
        <DialogContent className="max-w-2xl bg-nexus-surface-2 border-border/60 max-h-[90vh] overflow-y-auto nexus-scroll">
          {detailLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <FileCode className="w-4 h-4 text-primary" />
                  {detailLog.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                {/* Status + type badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${
                    detailLog.status === "SUCCESS" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                    detailLog.status === "FAILED" ? "text-red-400 border-red-500/30 bg-red-500/10" :
                    detailLog.status === "WARNING" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                    "text-cyan-400 border-cyan-500/30 bg-cyan-500/10"
                  }`}>
                    {detailLog.status}
                  </Badge>
                  {detailLog.type && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {detailLog.type}
                    </Badge>
                  )}
                  {detailLog.agentId && (
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/10">
                      Agent {detailLog.agentId}
                    </Badge>
                  )}
                </div>

                {/* Full details — live log */}
                {detailLog.details ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">Live Log</p>
                    <div className="rounded-lg bg-[#060b14] border border-border/40 p-3 max-h-[400px] overflow-y-auto nexus-scroll">
                      <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed">{detailLog.details}</pre>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Không có chi tiết log</p>
                )}

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-card/30 border border-border/30 p-2.5">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1">Thời gian</p>
                    <p className="font-medium">{fmtDate(detailLog.createdAt)}</p>
                  </div>
                  {detailLog.model && (
                    <div className="rounded-lg bg-card/30 border border-border/30 p-2.5">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1">Model</p>
                      <p className="font-mono text-[10px] truncate">{detailLog.model}</p>
                    </div>
                  )}
                  {detailLog.duration != null && (
                    <div className="rounded-lg bg-card/30 border border-border/30 p-2.5">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1">Duration</p>
                      <p className="font-medium">{fmtDuration(detailLog.duration)}</p>
                    </div>
                  )}
                  {detailLog.logCount != null && detailLog.logCount > 0 && (
                    <div className="rounded-lg bg-card/30 border border-border/30 p-2.5">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1">Log Lines</p>
                      <p className="font-medium">{detailLog.logCount} lines</p>
                    </div>
                  )}
                </div>

                {/* Copy button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    notify.copy(detailLog.details || detailLog.title, "Đã copy log!");
                  }}
                >
                  Copy log
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
