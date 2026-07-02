"use client";

import { useState, useEffect, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { useNexus } from "@/store/useNexus";
import { SectionEditor } from "../SectionEditor";
import { MermaidRenderer } from "../MermaidRenderer";
import { useReloadProject } from "../useReload";
import { GitGraph, Layout, Eye, Code2 } from "lucide-react";
import type { UMLData, DesignData, AnalysisData } from "@/lib/types";

function esc(s: unknown): string {
  return String(s ?? "");
}

const nodeColors: Record<string, string> = {
  actor: "#00d4aa",
  class: "#38bdf8",
  entity: "#f59e0b",
  process: "#a78bfa",
};

/** Parse ERD mermaid → React Flow nodes/edges */
function parseERD(mermaid: string): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  if (!mermaid) return { nodes, edges };

  // Extract entities: "entityName { ... }"
  const entityRegex = /(\w+)\s*\{([^}]*)\}/g;
  let match;
  let entityIndex = 0;
  const entityMap = new Map<string, string>();

  while ((match = entityRegex.exec(mermaid)) !== null) {
    const name = match[1];
    const body = match[2].trim();
    const fields = body.split("\n").map((l) => l.trim()).filter(Boolean);

    entityMap.set(name, name);
    nodes.push({
      id: name,
      position: {
        x: 150 + (entityIndex % 3) * 300,
        y: 50 + Math.floor(entityIndex / 3) * 250,
      },
      data: {
        label: (
          <div style={{ fontSize: 11, minWidth: 120 }}>
            <div style={{ fontWeight: 700, color: nodeColors.entity, borderBottom: "1px solid #1a2a40", paddingBottom: 4, marginBottom: 4 }}>
              {name}
            </div>
            {fields.slice(0, 8).map((f, i) => (
              <div key={i} style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8" }}>
                {f}
              </div>
            ))}
            {fields.length > 8 && <div style={{ fontSize: 10, color: "#64748b" }}>+{fields.length - 8} more</div>}
          </div>
        ),
      },
      style: {
        background: "#0c1322",
        border: `1px solid ${nodeColors.entity}`,
        borderRadius: 8,
        padding: 8,
      },
    });
    entityIndex++;
  }

  // Extract relationships: "A ||--o{ B : label"
  const relRegex = /(\w+)\s+(\|\|--+|--\|\||\}\|--\|\||\|\|--o\{|o\|--o\{)\s+(\w+)\s*:?\s*"?([^"\n]*)"?/g;
  while ((match = relRegex.exec(mermaid)) !== null) {
    const source = match[1];
    const target = match[3];
    const label = match[4]?.trim() || "";
    if (entityMap.has(source) && entityMap.has(target)) {
      edges.push({
        id: `${source}-${target}`,
        source,
        target,
        label: label || undefined,
        style: { stroke: "#475569", strokeWidth: 1.5 },
        labelStyle: { fontSize: 10, fill: "#64748b" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
      });
    }
  }

  return { nodes, edges };
}

/** Parse classDiagram mermaid → React Flow nodes/edges */
function parseClassDiagram(mermaid: string): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  if (!mermaid) return { nodes, edges };

  // Extract classes
  const classRegex = /class\s+(\w+)\s*\{([^}]*)\}/g;
  let match;
  let classIndex = 0;
  const classMap = new Map<string, string>();

  while ((match = classRegex.exec(mermaid)) !== null) {
    const name = match[1];
    const body = match[2].trim();
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

    classMap.set(name, name);
    nodes.push({
      id: name,
      position: {
        x: 100 + (classIndex % 4) * 280,
        y: 50 + Math.floor(classIndex / 4) * 220,
      },
      data: {
        label: (
          <div style={{ fontSize: 11, minWidth: 140 }}>
            <div style={{ fontWeight: 700, color: nodeColors.class, borderBottom: "1px solid #1a2a40", paddingBottom: 4, marginBottom: 4 }}>
              {name}
            </div>
            {lines.slice(0, 10).map((l, i) => (
              <div key={i} style={{ fontFamily: "monospace", fontSize: 9, color: l.startsWith("+") ? "#10b981" : "#94a3b8" }}>
                {l}
              </div>
            ))}
          </div>
        ),
      },
      style: {
        background: "#0c1322",
        border: `1px solid ${nodeColors.class}`,
        borderRadius: 8,
        padding: 8,
      },
    });
    classIndex++;
  }

  // Extract relationships (without 'class' prefix)
  const relRegex = /(\w+)\s+(<\|--|--\|>|-->\s*|<--|--|\.\.>|\.\.>)/g;
  while ((match = relRegex.exec(mermaid)) !== null) {
    const source = match[1];
    const arrow = match[2];
    // Find target (next word after arrow)
    const afterArrow = mermaid.substring(match.index + match[0].length).trim();
    const targetMatch = afterArrow.match(/^(\w+)/);
    if (targetMatch && classMap.has(source) && classMap.has(targetMatch[1])) {
      edges.push({
        id: `${source}-${targetMatch[1]}`,
        source,
        target: targetMatch[1],
        label: arrow.includes("<|") ? "extends" : arrow.includes(">") ? "uses" : "",
        style: { stroke: "#475569", strokeWidth: 1.5 },
        labelStyle: { fontSize: 9, fill: "#64748b" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
      });
    }
  }

  return { nodes, edges };
}

const TABS = [
  { id: "useCase", name: "Use Case", icon: Users },
  { id: "classDiagram", name: "Class (Interactive)", icon: Layout },
  { id: "erd", name: "ERD (Interactive)", icon: Layout },
  { id: "sequence", name: "Sequence", icon: GitGraph },
];

import { Users } from "lucide-react";

export function UMLTab() {
  const result = useNexus((s) => s.result);
  const reload = useReloadProject();
  const r = (result?.uml || {}) as Partial<UMLData>;
  const [active, setActive] = useState<string>("useCase");
  const [viewMode, setViewMode] = useState<"interactive" | "mermaid">("interactive");

  // Parse ERD
  const erdData = parseERD(r.erd || "");
  const [erdNodes, setErdNodes, onErdNodesChange] = useNodesState(erdData.nodes);
  const [erdEdges, setErdEdges, onErdEdgesChange] = useEdgesState(erdData.edges);

  // Parse Class
  const classData = parseClassDiagram(r.classDiagram || "");
  const [classNodes, setClassNodes, onClassNodesChange] = useNodesState(classData.nodes);
  const [classEdges, setClassEdges, onClassEdgesChange] = useEdgesState(classData.edges);

  const onConnect = useCallback(
    (params: Connection) => {
      if (active === "erd") setErdEdges((eds) => addEdge(params, eds));
      if (active === "classDiagram") setClassEdges((eds) => addEdge(params, eds));
    },
    [active, setErdEdges, setClassEdges]
  );

  // Re-parse when data changes
  useEffect(() => {
    if (active === "erd") {
      const d = parseERD(r.erd || "");
      setErdNodes(d.nodes);
      setErdEdges(d.edges);
    }
    if (active === "classDiagram") {
      const d = parseClassDiagram(r.classDiagram || "");
      setClassNodes(d.nodes);
      setClassEdges(d.edges);
    }
  }, [r.erd, r.classDiagram, active]);

  const isInteractive = (active === "erd" || active === "classDiagram") && viewMode === "interactive";
  const hasInteractiveNodes = active === "erd" ? erdNodes.length > 0 : classNodes.length > 0;

  return (
    <div className="space-y-6">
      <SectionEditor section="uml" title="UML Diagrams" content={r} onSaved={reload} />

      <p className="text-xs text-muted-foreground bg-secondary/30 border border-border rounded-lg p-3">
        Class Diagram va ERD ho tro keo tha (interactive) — ban co the di chuyen cac node, zoom,
        them/xoa ket noi. Use Case va Sequence dung Mermaid render.
      </p>

      {/* Tab buttons */}
      <div className="flex gap-1.5 flex-wrap items-center">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                active === t.id
                  ? "bg-primary/10 border border-primary text-primary"
                  : "bg-secondary/40 border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.name}
            </button>
          );
        })}
        {isInteractive && (
          <button
            onClick={() => setViewMode(viewMode === "interactive" ? "mermaid" : "interactive")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary/40 border border-border text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            {viewMode === "interactive" ? <Code2 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {viewMode === "interactive" ? "Xem Mermaid" : "Xem Interactive"}
          </button>
        )}
      </div>

      {/* Diagram content */}
      {active === "useCase" && <MermaidRenderer code={r.useCase || ""} id="uml-useCase" />}

      {active === "classDiagram" && (
        viewMode === "interactive" && hasInteractiveNodes ? (
          <div className="bg-[#060b14] border border-border rounded-xl overflow-hidden" style={{ height: 500 }}>
            <ReactFlow
              nodes={classNodes}
              edges={classEdges}
              onNodesChange={onClassNodesChange}
              onEdgesChange={onClassEdgesChange}
              onConnect={onConnect}
              fitView
              attributionPosition="bottom-left"
            >
              <Background color="#1a2a40" gap={20} />
              <Controls />
              <MiniMap
                nodeColor={(n) => {
                  const border = (n.style as { border?: string })?.border || "";
                  if (border.includes("#38bdf8")) return "#38bdf8";
                  if (border.includes("#f59e0b")) return "#f59e0b";
                  return "#475569";
                }}
                style={{ background: "#0c1322" }}
              />
            </ReactFlow>
          </div>
        ) : (
          <MermaidRenderer code={r.classDiagram || ""} id="uml-class" />
        )
      )}

      {active === "erd" && (
        viewMode === "interactive" && hasInteractiveNodes ? (
          <div className="bg-[#060b14] border border-border rounded-xl overflow-hidden" style={{ height: 500 }}>
            <ReactFlow
              nodes={erdNodes}
              edges={erdEdges}
              onNodesChange={onErdNodesChange}
              onEdgesChange={onErdEdgesChange}
              onConnect={onConnect}
              fitView
              attributionPosition="bottom-left"
            >
              <Background color="#1a2a40" gap={20} />
              <Controls />
              <MiniMap
                nodeColor={(n) => {
                  const border = (n.style as { border?: string })?.border || "";
                  if (border.includes("#38bdf8")) return "#38bdf8";
                  if (border.includes("#f59e0b")) return "#f59e0b";
                  return "#475569";
                }}
                style={{ background: "#0c1322" }}
              />
            </ReactFlow>
          </div>
        ) : (
          <MermaidRenderer code={r.erd || ""} id="uml-erd" />
        )
      )}

      {active === "sequence" && <MermaidRenderer code={r.sequence || ""} id="uml-sequence" />}
    </div>
  );
}
