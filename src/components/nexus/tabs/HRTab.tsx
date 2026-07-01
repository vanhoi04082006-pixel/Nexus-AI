"use client";

import { useNexus } from "@/store/useNexus";
import { Card, CardContent } from "@/components/ui/card";
import { SectionEditor } from "../SectionEditor";
import { useReloadProject } from "../useReload";
import { IdCard, TriangleAlert, Lightbulb } from "lucide-react";
import type { HRData } from "@/lib/types";

function esc(s: unknown): string {
  return String(s ?? "");
}

const ROLE_COLORS = [
  "border-l-primary",
  "border-l-sky-400",
  "border-l-amber-400",
  "border-l-destructive",
  "border-l-purple-400",
  "border-l-pink-400",
];

export function HRTab() {
  const result = useNexus((s) => s.result);
  const reload = useReloadProject();
  const r = (result?.hr || {}) as Partial<HRData>;
  const assignments = r.assignments || [];

  const roles = new Set(assignments.map((a) => a.role?.split("/")[0].trim()));

  return (
    <div className="space-y-6">
      <SectionEditor section="hr" title="Phan Nhan Su" content={r} onSaved={reload} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-5 text-center">
            <div className="text-2xl font-bold text-primary font-mono">{assignments.length}</div>
            <div className="text-xs text-muted-foreground mt-1">Thanh vien</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5 text-center">
            <div className="text-2xl font-bold text-primary font-mono">{roles.size}</div>
            <div className="text-xs text-muted-foreground mt-1">Vai tro</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-5 text-center">
            <div className="text-2xl font-bold text-primary font-mono">{esc(r.coverage)}</div>
            <div className="text-xs text-muted-foreground mt-1">Phu hop</div>
          </CardContent>
        </Card>
      </div>

      {/* Assignments */}
      <div>
        <h3 className="flex items-center gap-2 text-base font-bold mb-3">
          <IdCard className="w-4 h-4 text-primary" /> Phan cong Vai tro
        </h3>
        <div className="space-y-3">
          {assignments.map((m, i) => (
            <Card
              key={i}
              className={`bg-card border-border border-l-4 ${ROLE_COLORS[i % ROLE_COLORS.length]}`}
            >
              <CardContent className="p-4">
                <div className="flex justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-lg font-bold">{esc(m.name)}</div>
                    <div className="text-sm text-primary font-semibold mt-0.5">{esc(m.role)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Workload</div>
                    <div
                      className={`text-xl font-bold font-mono ${
                        (m.workload || 0) > 90 ? "text-amber-400" : "text-primary"
                      }`}
                    >
                      {m.workload || 0}%
                    </div>
                  </div>
                </div>
                {m.reason && (
                  <div className="mt-2.5 text-xs text-muted-foreground flex items-start gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>{esc(m.reason)}</span>
                  </div>
                )}
                <div className="mt-2 text-[11px] text-muted-foreground/70">
                  Uu: {esc(m.strengths) || "N/A"} | Nhuoc: {esc(m.weaknesses) || "N/A"}
                </div>
                {m.modules && m.modules.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {m.modules.map((x, j) => (
                      <span
                        key={j}
                        className="px-2.5 py-0.5 bg-secondary/40 border border-border rounded text-[11px]"
                      >
                        {esc(x)}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Risks */}
      {r.risks && r.risks.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold mb-3">
            <TriangleAlert className="w-4 h-4 text-amber-400" /> Rui ro
          </h3>
          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto nexus-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase">
                    <th className="text-left px-4 py-2.5 font-semibold">Rui ro</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Giam thieu</th>
                  </tr>
                </thead>
                <tbody>
                  {r.risks.map((x, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2.5 text-amber-400">{esc(x.risk)}</td>
                      <td className="px-4 py-2.5">{esc(x.mitigation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
