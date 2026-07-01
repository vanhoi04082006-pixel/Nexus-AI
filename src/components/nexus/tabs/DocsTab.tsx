"use client";

import { useState } from "react";
import { useNexus } from "@/store/useNexus";
import { SectionEditor } from "../SectionEditor";
import { useReloadProject } from "../useReload";
import { Book, Code, Plug } from "lucide-react";
import type { DocsData } from "@/lib/types";

function esc(s: unknown): string {
  return String(s ?? "");
}

const TABS = [
  { id: "readme", name: "README.md", icon: Book },
  { id: "convention", name: "Coding Convention", icon: Code },
  { id: "apiStandard", name: "API Standard", icon: Plug },
];

export function DocsTab() {
  const result = useNexus((s) => s.result);
  const reload = useReloadProject();
  const r = (result?.docs || {}) as Partial<DocsData>;
  const [active, setActive] = useState<string>("readme");

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {});
  }

  return (
    <div className="space-y-6">
      <SectionEditor section="docs" title="Tai Lieu" content={r} onSaved={reload} />

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

      <div className="bg-[#060b14] border border-border rounded-xl overflow-hidden">
        <div className="flex justify-between items-center px-4 py-2 bg-[#0c1322] border-b border-border">
          <span className="text-xs text-muted-foreground font-mono">
            {TABS.find((t) => t.id === active)?.name}
          </span>
          <button
            onClick={() => copy((r as Record<string, string | undefined>)[active] || "")}
            className="text-[11px] text-muted-foreground border border-border px-2 py-0.5 rounded hover:border-primary hover:text-primary transition-colors"
          >
            Copy
          </button>
        </div>
        <pre className="px-4 py-3 overflow-x-auto nexus-scroll font-mono text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap min-h-[200px]">
          {esc((r as Record<string, string | undefined>)[active]) || "Khong co du lieu"}
        </pre>
      </div>
    </div>
  );
}
