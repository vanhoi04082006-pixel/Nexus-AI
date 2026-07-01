"use client";

import { useNexus } from "@/store/useNexus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionEditor } from "../SectionEditor";
import { useReloadProject } from "../useReload";
import {
  Users,
  Clock,
  Gauge,
  Layers,
  UsersRound,
  ListCheck,
  Puzzle,
  Monitor,
  Server,
  Database,
  Zap,
} from "lucide-react";
import type { AnalysisData } from "@/lib/types";

function esc(s: unknown): string {
  return String(s ?? "");
}

export function AnalysisTab() {
  const result = useNexus((s) => s.result);
  const reload = useReloadProject();
  const r = (result?.analysis || {}) as Partial<AnalysisData>;

  const techStacks = [
    { i: Monitor, l: "Frontend", d: r.techStack?.frontend },
    { i: Server, l: "Backend", d: r.techStack?.backend },
    { i: Database, l: "Database", d: r.techStack?.database },
    { i: Zap, l: "Cache", d: r.techStack?.cache },
  ].filter((t) => t.d);

  return (
    <div className="space-y-6">
      <SectionEditor section="analysis" title="Phan Tich Chu De" content={r} onSaved={reload} />

      {/* Description */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="w-4 h-4 text-primary" /> Mo ta Du an
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">{esc(r.desc)}</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="bg-secondary/40 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <strong>{r.teamSize || 0}</strong> thanh vien
            </div>
            <div className="bg-secondary/40 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <strong>{esc(r.estimatedDuration)}</strong>
            </div>
            <div className="bg-secondary/40 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4 text-sky-400" />
              <strong>{esc(r.complexity)}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tech stack */}
      <div>
        <h3 className="flex items-center gap-2 text-base font-bold mb-3">
          <Layers className="w-4 h-4 text-primary" /> Tech Stack
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {techStacks.map((t) => {
            const Icon = t.i;
            return (
              <Card key={t.l} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground font-semibold">{t.l}</span>
                  </div>
                  <div className="font-semibold text-sm mb-1">{esc(t.d?.name)}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">v{esc(t.d?.ver)}</div>
                  <div className="text-xs text-muted-foreground/70 mt-1.5">{esc(t.d?.reason)}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {r.techStack?.tools && r.techStack.tools.length > 0 && (
          <Card className="bg-card border-border mt-3">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground font-semibold mb-2">Tools</div>
              <div className="flex flex-wrap gap-1.5">
                {r.techStack.tools.map((t, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-secondary/40 border border-border rounded-md text-xs"
                  >
                    {esc(t)}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Actors */}
      {r.actors && r.actors.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold mb-3">
            <UsersRound className="w-4 h-4 text-primary" /> Actors
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {r.actors.map((a, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{esc(a.name)}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{esc(a.desc)}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      {r.features && r.features.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold mb-3">
            <ListCheck className="w-4 h-4 text-primary" /> Chuc nang
          </h3>
          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto nexus-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase">
                    <th className="text-left px-4 py-2.5 font-semibold">Chuc nang</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Module</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Uu tien</th>
                  </tr>
                </thead>
                <tbody>
                  {r.features.map((f, i) => (
                    <tr key={i} className="border-t border-border hover:bg-primary/[0.02]">
                      <td className="px-4 py-2.5">{esc(f.name)}</td>
                      <td className="px-4 py-2.5">
                        <code className="text-primary text-xs">{esc(f.module)}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`pri-${(f.pri || "P1").toLowerCase()}`}>{esc(f.pri)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Modules */}
      {r.modules && r.modules.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold mb-3">
            <Puzzle className="w-4 h-4 text-primary" /> Modules
          </h3>
          <div className="flex flex-wrap gap-2">
            {r.modules.map((m, i) => (
              <span
                key={i}
                className="px-3 py-2 bg-card border border-border rounded-lg text-sm"
              >
                <span className="text-primary font-mono mr-1.5">M{i + 1}</span>
                {esc(m)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
