"use client";

import { useEffect, useMemo, useRef } from "react";
import { useNexus, type LogEntry, type LogLevel } from "@/store/useNexus";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Cpu,
  AlertTriangle,
  Terminal,
  Key,
  Activity,
} from "lucide-react";

/* ===========================================================
   Helpers
=========================================================== */
function fmtTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const LEVEL_STYLES: Record<LogLevel, { text: string; prefix: string }> = {
  info: { text: "text-slate-300", prefix: "" },
  success: { text: "text-emerald-400", prefix: "" },
  warn: { text: "text-amber-400", prefix: "" },
  error: { text: "text-rose-400", prefix: "" },
};

const PROVIDER_BADGE: Record<string, { label: string; bg: string }> = {
  openrouter: { label: "OR", bg: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  deepseek: { label: "DS", bg: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  cache: { label: "CACHE", bg: "bg-slate-500/20 text-slate-300 border-slate-500/40" },
  fallback: { label: "FALLBACK", bg: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
  pipeline: { label: "PIPE", bg: "bg-teal-500/20 text-teal-300 border-teal-500/40" },
};

/* ===========================================================
   Main overlay
=========================================================== */
export function ProcessingOverlay() {
  const agents = useNexus((s) => s.agents);
  const error = useNexus((s) => s.pipelineError);
  const logs = useNexus((s) => s.logs);
  const termRef = useRef<HTMLDivElement>(null);

  const doneCount = agents.filter((a) => a.status === "done").length;
  const failedCount = agents.filter((a) => a.status === "failed").length;
  const runningCount = agents.filter((a) => a.status === "running").length;
  const total = agents.length || 8;
  const pct = Math.round((doneCount / total) * 100);

  const hasError = !!error;

  // Always-on auto-scroll to the latest log line
  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [logs]);

  // Derived stats for the log header
  const logStats = useMemo(() => {
    const success = logs.filter((l) => l.level === "success").length;
    const errors = logs.filter((l) => l.level === "error").length;
    const warns = logs.filter((l) => l.level === "warn").length;
    return { success, errors, warns };
  }, [logs]);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-5xl max-h-[94vh] bg-[#0c1322] border border-primary/30 rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 flex flex-col">
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-border flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              hasError ? "bg-destructive/15" : "bg-primary/15"
            }`}
          >
            {hasError ? (
              <AlertTriangle className="w-5 h-5 text-destructive" />
            ) : (
              <Cpu className={`w-5 h-5 text-primary ${!hasError && "nexus-spin"}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">
              {hasError ? "Lỗi xảy ra" : "Đang chạy Multi-Agent Pipeline..."}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {hasError ? error : "8 AI Agent đang xử lý dự án — theo dõi real-time model / key / agent"}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {logStats.success} ✓
            </span>
            <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {logStats.warns} ⚠
            </span>
            <span className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {logStats.errors} ✗
            </span>
          </div>
        </div>

        {/* Body: two columns (agents board | live log console) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] overflow-hidden">
          {/* ===== LEFT: Agent board ===== */}
          <div className="border-b lg:border-b-0 lg:border-r border-border flex flex-col min-h-0">
            <div className="px-5 sm:px-6 pt-3 pb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Activity className="w-3.5 h-3.5" />
              Agent Board
              <span className="ml-auto font-mono text-[11px] normal-case">
                {doneCount + failedCount}/{total}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto nexus-scroll px-5 sm:px-6 pb-3 space-y-2 max-h-[40vh] lg:max-h-none">
              {agents.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-lg border px-3 py-2 transition-colors ${
                    a.status === "running"
                      ? "border-primary/40 bg-primary/5"
                      : a.status === "done"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : a.status === "failed"
                      ? "border-rose-500/30 bg-rose-500/5"
                      : "border-border/60 bg-muted/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold font-mono text-[11px]">
                      {a.id}
                    </span>
                    <span className="text-foreground text-xs font-medium truncate flex-1">
                      {a.name}
                    </span>
                    {a.status === "running" && (
                      <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                    )}
                    {a.status === "done" && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                    {a.status === "failed" && (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-muted-foreground/70 text-[10.5px] mt-0.5 font-mono pl-7">
                    {a.status === "pending" && "Đang chờ..."}
                    {a.status === "running" && "Đang xử lý..."}
                    {a.status === "done" && "Hoàn thành ✓"}
                    {a.status === "failed" && `Thất bại — ${a.error || "fallback"}`}
                  </div>
                </div>
              ))}
              {hasError && (
                <div className="mt-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  <div className="font-bold mb-1">Lỗi:</div>
                  <div className="break-words">{error}</div>
                  <div className="mt-2 text-muted-foreground">
                    Kiểm tra lại dữ liệu đầu vào và thử lại. AI service có thể đang tải.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ===== RIGHT: Live Log Console ===== */}
          <div className="flex flex-col min-h-0 bg-[#0a0f1c]">
            <div className="px-5 sm:px-6 pt-3 pb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground border-b border-border/60">
              <Terminal className="w-3.5 h-3.5" />
              Live Log Console
              <span className="ml-auto font-mono text-[11px] normal-case text-muted-foreground/80">
                {logs.length} line{logs.length === 1 ? "" : "s"}
              </span>
            </div>
            <div
              ref={termRef}
              className="flex-1 overflow-y-auto nexus-scroll px-3 sm:px-4 py-3 font-mono text-[11.5px] leading-relaxed min-h-[200px] max-h-[40vh] lg:max-h-none"
            >
              {logs.length === 0 && (
                <div className="text-muted-foreground/60 italic flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Đang chờ log đầu tiên từ pipeline...
                </div>
              )}
              {logs.map((l: LogEntry) => {
                const lvl = LEVEL_STYLES[l.level];
                const prov = l.provider ? PROVIDER_BADGE[l.provider] : null;
                return (
                  <div
                    key={l.id}
                    className="flex items-start gap-2 py-0.5 hover:bg-white/[0.02] -mx-1 px-1 rounded"
                  >
                    {/* timestamp */}
                    <span className="text-slate-500 shrink-0 tabular-nums">
                      {fmtTime(l.ts)}
                    </span>
                    {/* agent tag */}
                    {l.agentId && l.agentId !== "PIPELINE" && (
                      <span className="shrink-0 px-1 rounded bg-primary/15 text-primary border border-primary/30 text-[10px] font-bold">
                        {l.agentId}
                      </span>
                    )}
                    {/* provider badge */}
                    {prov && (
                      <span
                        className={`shrink-0 px-1 rounded text-[9.5px] font-bold border ${prov.bg}`}
                      >
                        {prov.label}
                      </span>
                    )}
                    {/* key index */}
                    {l.keyIndex != null && (
                      <span className="shrink-0 flex items-center gap-0.5 px-1 rounded bg-slate-700/40 text-slate-300 border border-slate-600/40 text-[9.5px] font-bold">
                        <Key className="w-2 h-2" />
                        #{l.keyIndex}
                      </span>
                    )}
                    {/* message */}
                    <span className={`${lvl.text} break-all`}>
                      {l.message}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="px-5 sm:px-6 py-3 border-t border-border">
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500"
              style={{ width: `${hasError ? 100 : pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground font-mono">
            <span>
              {doneCount} done
              {runningCount > 0 ? ` · ${runningCount} running` : ""}
              {failedCount > 0 ? ` · ${failedCount} fallback` : ""}
            </span>
            <span>{hasError ? "ERROR" : `${pct}%`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
