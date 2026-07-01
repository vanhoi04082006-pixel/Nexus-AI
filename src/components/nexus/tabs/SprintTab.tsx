"use client";

import { useNexus } from "@/store/useNexus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionEditor } from "../SectionEditor";
import { useReloadProject } from "../useReload";
import { CalendarRange, Flag, Milestone, Calendar, List } from "lucide-react";
import type { SprintData } from "@/lib/types";

function esc(s: unknown): string {
  return String(s ?? "");
}

export function SprintTab() {
  const result = useNexus((s) => s.result);
  const reload = useReloadProject();
  const r = (result?.sprint || {}) as Partial<SprintData>;
  const sprints = r.sprints || [];
  const cls = ["#00d4aa", "#38bdf8", "#f59e0b"];

  return (
    <div className="space-y-6">
      <SectionEditor section="sprint" title="Sprint Planning" content={r} onSaved={reload} />

      {/* Overview */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="w-4 h-4 text-primary" /> Tong quan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            {r.totalSprints || 0} Sprint x {esc(r.sprintDuration)}
          </div>
          <div className="space-y-3">
            {sprints.map((s, i) => {
              const p = Math.round(((i + 1) / Math.max(sprints.length, 1)) * 100);
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold">{esc(s.name)}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {esc(s.start)} → {esc(s.end)}
                    </span>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${p}%`, background: s.color || cls[i % 3] }}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                    {(s.tasks || []).length} tasks
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sprint details */}
      {sprints.map((s, si) => (
        <div key={si}>
          <h3 className="flex items-center gap-2 text-base font-bold mb-3">
            <Flag className="w-4 h-4" style={{ color: s.color || cls[si % 3] }} />
            {esc(s.name)}
          </h3>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex gap-4 flex-wrap mb-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {esc(s.start)} → {esc(s.end)}
                </span>
                <span className="flex items-center gap-1">
                  <List className="w-3.5 h-3.5" /> {(s.tasks || []).length} tasks
                </span>
              </div>
              {s.goals && s.goals.length > 0 && (
                <>
                  <div className="text-xs text-muted-foreground/70 font-semibold mb-1.5">Muc tieu:</div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {s.goals.map((g, j) => (
                      <span
                        key={j}
                        className="px-3 py-1 bg-primary/[0.06] border border-primary/15 rounded-md text-xs text-primary"
                      >
                        {esc(g)}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <div className="overflow-x-auto nexus-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase">
                      <th className="text-left px-3 py-2 font-semibold">Task</th>
                      <th className="text-left px-3 py-2 font-semibold">Assignee</th>
                      <th className="text-left px-3 py-2 font-semibold">Hours</th>
                      <th className="text-left px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(s.tasks || []).map((t, j) => (
                      <tr key={j} className="border-t border-border">
                        <td className="px-3 py-2">{esc(t.task)}</td>
                        <td className="px-3 py-2 text-sky-400">{esc(t.assignee)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{t.hours || 0}h</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 bg-secondary/40 text-muted-foreground rounded text-[11px]">
                            {esc(t.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}

      {/* Milestones */}
      {r.milestones && r.milestones.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold mb-3">
            <Milestone className="w-4 h-4 text-primary" /> Milestones
          </h3>
          <div className="relative pl-5">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-primary/30" />
            {r.milestones.map((m, i) => (
              <div key={i} className="relative pl-5 py-2 pb-4">
                <div
                  className={`absolute -left-[13px] top-3 w-3 h-3 rounded-full border-2 border-primary ${
                    i === r.milestones!.length - 1 ? "bg-primary" : "bg-secondary"
                  }`}
                />
                <div className="font-semibold text-sm">{esc(m.event)}</div>
                <div className="text-xs text-muted-foreground font-mono">{esc(m.date)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
