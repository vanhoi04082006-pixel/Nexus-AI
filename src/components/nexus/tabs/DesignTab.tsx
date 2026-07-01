"use client";

import { useNexus } from "@/store/useNexus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionEditor } from "../SectionEditor";
import { MermaidRenderer } from "../MermaidRenderer";
import { useReloadProject } from "../useReload";
import { Building, Table, Plug, FolderTree } from "lucide-react";
import type { DesignData } from "@/lib/types";

function esc(s: unknown): string {
  return String(s ?? "");
}

const METHOD_CLASS: Record<string, string> = {
  GET: "method-get",
  POST: "method-post",
  PUT: "method-put",
  DELETE: "method-delete",
  PATCH: "method-put",
};

export function DesignTab() {
  const result = useNexus((s) => s.result);
  const reload = useReloadProject();
  const r = (result?.design || {}) as Partial<DesignData>;

  // Architecture diagram (built from tech stack + analysis)
  const analysis = result?.analysis;
  const archCode = `graph TB
    subgraph FE["Frontend - ${esc(analysis?.techStack?.frontend?.name || "React")}"]
        UI[Components] --> State[State Mgmt]
        State --> API_SVC[API Service]
    end
    subgraph BE["Backend - ${esc(analysis?.techStack?.backend?.name || "API")}"]
        Controller[Controllers] --> Service[Services]
        Service --> Repo[Repositories]
    end
    subgraph Data["Data Layer"]
        DB[("${esc(analysis?.techStack?.database?.name || "Database")}")]
        Cache[("${esc(analysis?.techStack?.cache?.name || "Cache")}")]
        Repo --> DB
        Service --> Cache
    end
    API_SVC -->|HTTP / REST| Controller
    style FE fill:#0c1322,stroke:#00d4aa,color:#00d4aa
    style BE fill:#0c1322,stroke:#38bdf8,color:#38bdf8
    style Data fill:#0c1322,stroke:#f59e0b,color:#f59e0b`;

  return (
    <div className="space-y-6">
      <SectionEditor section="design" title="Thiet Ke He Thong" content={r} onSaved={reload} />

      {/* Architecture */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building className="w-4 h-4 text-primary" /> Kien truc He thong
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed mb-4">{esc(r.architectureDesc)}</p>
          <MermaidRenderer code={archCode} id="arch" />
        </CardContent>
      </Card>

      {/* DB tables */}
      {r.dbTables && r.dbTables.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold mb-3">
            <Table className="w-4 h-4 text-primary" /> Database Schema
          </h3>
          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto nexus-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase">
                    <th className="text-left px-4 py-2.5 font-semibold">Table</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Columns</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Relations</th>
                  </tr>
                </thead>
                <tbody>
                  {r.dbTables.map((t, i) => (
                    <tr key={i} className="border-t border-border hover:bg-primary/[0.02]">
                      <td className="px-4 py-2.5 font-semibold text-primary font-mono text-xs">
                        {esc(t.name)}
                      </td>
                      <td className="px-4 py-2.5 text-xs">{(t.columns || []).join(", ")}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {(t.relations || []).join("; ") || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* API endpoints */}
      {r.apiEndpoints && r.apiEndpoints.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold mb-3">
            <Plug className="w-4 h-4 text-primary" /> API Endpoints
          </h3>
          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto nexus-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/40 text-muted-foreground text-xs uppercase">
                    <th className="text-left px-4 py-2.5 font-semibold">Method</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Endpoint</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Mo ta</th>
                  </tr>
                </thead>
                <tbody>
                  {r.apiEndpoints.map((e, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                            METHOD_CLASS[e.method] || "bg-secondary/40 text-muted-foreground"
                          }`}
                        >
                          {esc(e.method)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{esc(e.path)}</td>
                      <td className="px-4 py-2.5 text-sm">{esc(e.desc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Folder structure */}
      {r.folderStructure && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold mb-3">
            <FolderTree className="w-4 h-4 text-primary" /> Folder Structure
          </h3>
          <div className="bg-[#060b14] border border-border rounded-xl overflow-hidden">
            <div className="flex justify-between items-center px-4 py-2 bg-[#0c1322] border-b border-border">
              <span className="text-xs text-muted-foreground font-mono">📁 project-structure</span>
            </div>
            <pre className="px-4 py-3 overflow-x-auto nexus-scroll font-mono text-xs leading-relaxed text-foreground/90 whitespace-pre">
              {esc((r.folderStructure || "").replace(/\\n/g, "\n").replace(/\\\\n/g, "\n"))}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
