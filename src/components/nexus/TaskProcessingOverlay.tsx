"use client";

import { useEffect, useMemo, useRef } from "react";
import type { LogEntry, LogLevel } from "@/store/useNexus";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Terminal,
  Key,
  ListChecks,
  RefreshCw,
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
  cache: { label: "CACHE", bg: "bg-slate-500/20 text-slate-300 border-slate-500/40" },
  fallback: { label: "FALLBACK", bg: "bg-rose-500/20 text-rose-300 border-rose-500/40" },
  pipeline: { label: "TASK", bg: "bg-teal-500/20 text-teal-300 border-teal-500/40" },
};

interface TaskProcessingOverlayProps {
  /** "init" = todolist generation, "refine" = AI refine */
  mode: "init" | "refine";
  /** Live log entries */
  logs: LogEntry[];
  /** Optional error message (shown as red banner if set) */
  error?: string | null;
  /** Optional progress message (shown above log console) */
  progressMessage?: string;
}

/**
 * Compact overlay for task generation + AI refine — shows a left-side
 * "thinking" panel (section/member being processed) + right-side Live Log Console.
 * Reused by both WorkspaceView (init) and ChatTab (refine).
 */
export function TaskProcessingOverlay({
  mode,
  logs,
  error,
  progressMessage,
}: TaskProcessingOverlayProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const hasError = !!error;

  const isInit = mode === "init";
  const title = isInit ? "Đang sinh Todolist..." : "AI đang Refine sections...";
  const subtitle = isInit
    ? "Task Generator đọc phân tích + nhân sự → sinh SMART task cho từng thành viên"
    : "Refine đọc chat + edit requests → sửa lại tất cả sections (Analysis, HR, Sprint, Design, UML, Docs, Git)";
  const Icon = isInit ? ListChecks : RefreshCw;
  const agentTag = isInit ? "TASK" : "REFINE";

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

  // Extract "thinking" lines — the most recent info/success log per agentId bucket
  // so the left panel shows what AI is currently doing.
  const thinkingLines = useMemo(() => {
    const seen = new Map<string, LogEntry>();
    for (const l of logs) {
      if (l.level === "error" || l.level === "warn") continue;
      // Use agentId (or model) as the bucket key
      const key = l.agentId || l.model || "main";
      seen.set(key, l);
    }
    return Array.from(seen.values()).slice(-6);
  }, [logs]);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-xl z-50 flex items-center justify-center p-3 sm:p-4 nexus-shimmer">
      <div className="w-full max-w-5xl max-h-[94vh] bg-[#0c1322] border border-primary/30 rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 flex flex-col nexus-hud nexus-neon-border nexus-boot">
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
              <Icon className={`w-5 h-5 text-primary ${!hasError && "nexus-spin"}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">
              {hasError ? "Lỗi xảy ra" : title}
            </h3>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
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

        {/* Body: two columns (thinking panel | live log console) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] overflow-hidden">
          {/* ===== LEFT: AI thinking panel ===== */}
          <div className="border-b lg:border-b-0 lg:border-r border-border flex flex-col min-h-0">
            <div className="px-5 sm:px-6 pt-3 pb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Icon className="w-3.5 h-3.5" />
              AI đang làm gì
            </div>
            <div className="flex-1 overflow-y-auto nexus-scroll px-5 sm:px-6 pb-3 space-y-2 max-h-[40vh] lg:max-h-none">
              {progressMessage && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-primary/70 mb-0.5">
                    Trạng thái
                  </div>
                  <div className="text-xs text-foreground flex items-center gap-2">
                    <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />
                    <span className="truncate">{progressMessage}</span>
                  </div>
                </div>
              )}
              {thinkingLines.length === 0 && !progressMessage && (
                <div className="text-muted-foreground/60 italic text-xs flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Đang khởi tạo...
                </div>
              )}
              {thinkingLines.map((l) => (
                <div
                  key={l.id}
                  className="rounded-lg border border-border/60 bg-muted/5 px-3 py-2"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {l.level === "success" ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Loader2 className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
                    )}
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {l.agentId || l.model || "main"}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 ml-auto font-mono">
                      {fmtTime(l.ts)}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-foreground/90 break-words leading-snug">
                    {l.message}
                  </div>
                </div>
              ))}
              {hasError && (
                <div className="mt-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  <div className="font-bold mb-1">Lỗi:</div>
                  <div className="break-words">{error}</div>
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
                  Đang chờ log đầu tiên...
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
                    <span className="text-slate-500 shrink-0 tabular-nums">
                      {fmtTime(l.ts)}
                    </span>
                    {l.agentId && l.agentId !== agentTag && (
                      <span className="shrink-0 px-1 rounded bg-primary/15 text-primary border border-primary/30 text-[10px] font-bold">
                        {l.agentId}
                      </span>
                    )}
                    {l.agentId === agentTag && (
                      <span className="shrink-0 px-1 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30 text-[10px] font-bold">
                        {agentTag}
                      </span>
                    )}
                    {prov && (
                      <span
                        className={`shrink-0 px-1 rounded text-[9.5px] font-bold border ${prov.bg}`}
                      >
                        {prov.label}
                      </span>
                    )}
                    {l.keyIndex != null && (
                      <span className="shrink-0 flex items-center gap-0.5 px-1 rounded bg-slate-700/40 text-slate-300 border border-slate-600/40 text-[9.5px] font-bold">
                        <Key className="w-2 h-2" />
                        #{l.keyIndex}
                      </span>
                    )}
                    <span className={`${lvl.text} break-all`}>{l.message}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span className="flex items-center gap-1.5">
            {hasError ? (
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            )}
            {hasError ? "ERROR" : isInit ? "Đang sinh task..." : "Đang refine..."}
          </span>
          <span>{logs.length} log line(s)</span>
        </div>
      </div>
    </div>
  );
}
