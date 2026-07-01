"use client";

import { useEffect, useRef } from "react";
import { useNexus } from "@/store/useNexus";
import { CheckCircle2, XCircle, Loader2, Cpu, AlertTriangle } from "lucide-react";

export function ProcessingOverlay() {
  const agents = useNexus((s) => s.agents);
  const error = useNexus((s) => s.pipelineError);
  const termRef = useRef<HTMLDivElement>(null);

  const doneCount = agents.filter((a) => a.status === "done").length;
  const failedCount = agents.filter((a) => a.status === "failed").length;
  const total = agents.length || 8;
  const pct = Math.round((doneCount / total) * 100);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [agents]);

  const hasError = !!error;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] bg-[#0c1322] border border-primary/30 rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
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
          <div className="flex-1">
            <h3 className="font-semibold text-base">
              {hasError ? "Loi xay ra" : "Dang chay Multi-Agent Pipeline..."}
            </h3>
            <p className="text-xs text-muted-foreground">
              {hasError ? error : "8 AI Agent dang xu ly du an cua ban"}
            </p>
          </div>
        </div>

        {/* Terminal */}
        <div
          ref={termRef}
          className="flex-1 overflow-y-auto nexus-scroll px-6 py-4 font-mono text-xs leading-relaxed min-h-[280px]"
        >
          {agents.map((a) => (
            <div key={a.id} className="mb-3">
              <div className="flex items-center gap-2">
                <span className="text-primary font-bold">[AGENT-{a.id}]</span>
                <span className="text-foreground">{a.name}</span>
                {a.status === "running" && (
                  <Loader2 className="w-3 h-3 text-amber-400 animate-spin ml-1" />
                )}
                {a.status === "done" && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-1" />
                )}
                {a.status === "failed" && (
                  <XCircle className="w-3.5 h-3.5 text-destructive ml-1" />
                )}
              </div>
              <div className="text-muted-foreground/70 text-[11px] mt-0.5">
                {a.status === "pending" && "Dang cho..."}
                {a.status === "running" && "Dang xu ly..."}
                {a.status === "done" && "Hoan thanh ✓"}
                {a.status === "failed" && `That bai — ${a.error || "fallback"}`}
              </div>
            </div>
          ))}
          {hasError && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
              <div className="font-bold mb-1">Loi:</div>
              <div>{error}</div>
              <div className="mt-2 text-muted-foreground">
                Kiem tra lai du lieu dau vao va thu lai. AI service co the dang tai.
              </div>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="px-6 py-4 border-t border-border">
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500"
              style={{ width: `${hasError ? 100 : pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground font-mono">
            <span>
              {doneCount} done{failedCount > 0 ? ` · ${failedCount} fallback` : ""}
            </span>
            <span>{hasError ? "ERROR" : `${pct}%`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
