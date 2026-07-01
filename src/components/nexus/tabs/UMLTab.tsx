"use client";

import { useState } from "react";
import { useNexus } from "@/store/useNexus";
import { SectionEditor } from "../SectionEditor";
import { MermaidRenderer } from "../MermaidRenderer";
import { useReloadProject } from "../useReload";
import { Users, Boxes, Database, ArrowRightLeft } from "lucide-react";
import type { UMLData } from "@/lib/types";

const TABS = [
  { id: "useCase", name: "Use Case", icon: Users },
  { id: "classDiagram", name: "Class", icon: Boxes },
  { id: "erd", name: "ERD", icon: Database },
  { id: "sequence", name: "Sequence", icon: ArrowRightLeft },
];

export function UMLTab() {
  const result = useNexus((s) => s.result);
  const reload = useReloadProject();
  const r = (result?.uml || {}) as Partial<UMLData>;
  const [active, setActive] = useState<string>("useCase");

  return (
    <div className="space-y-6">
      <SectionEditor section="uml" title="UML Diagrams" content={r} onSaved={reload} />

      <p className="text-xs text-muted-foreground bg-secondary/30 border border-border rounded-lg p-3">
        UML diagrams duoc ve bang Mermaid.js. Leader co the chinh sua code Mermaid trong phan edit
        de them chi tiet. Dam bao moi bieu do the hien day du cac actor / class / entity.
      </p>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
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
      </div>

      {/* Active diagram */}
      <MermaidRenderer
        code={(r as Record<string, string | undefined>)[active] || ""}
        id={`uml-${active}`}
      />
    </div>
  );
}
