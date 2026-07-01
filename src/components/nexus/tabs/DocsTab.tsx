"use client";

import { useState } from "react";
import { useNexus } from "@/store/useNexus";
import { SectionEditor } from "../SectionEditor";
import { useReloadProject } from "../useReload";
import { Book, Code, Plug, Copy, Check } from "lucide-react";
import type { DocsData } from "@/lib/types";

function esc(s: unknown): string {
  return String(s ?? "");
}

/** Convert literal \n to real newlines (AI often returns escaped newlines) */
function fixNewlines(s: string): string {
  if (!s) return "";
  return s.replace(/\\n/g, "\n").replace(/\\\\n/g, "\n");
}

/** Simple markdown renderer — converts headings, bold, code, lists to HTML */
function renderMarkdown(text: string): string {
  if (!text) return "";
  let html = esc(text);

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-foreground mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-primary mt-5 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-primary mt-5 mb-3">$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="text-primary bg-secondary/40 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>');

  // Code blocks (triple backtick)
  html = html.replace(/```[\s\S]*?```/g, (m) => {
    const code = m.replace(/```\w*\n?/, "").replace(/```$/, "");
    return `<pre class="bg-[#060b14] border border-border rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-foreground/80">${code}</pre>`;
  });

  // Bullet lists
  html = html.replace(/^[\s]*[-*] (.+)$/gm, '<li class="ml-4 text-sm text-foreground/80 list-disc">$1</li>');
  html = html.replace(/(<li[^>]*>.*?<\/li>\n?)+/g, (m) => `<ul class="my-2 space-y-1">${m}</ul>`);

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 text-sm text-foreground/80 list-decimal">$1</li>');

  // Tables (simple)
  html = html.replace(/^\|(.+)\|$/gm, (m) => {
    const cells = m.split("|").filter((c) => c.trim());
    if (cells.every((c) => /^[\s-]+$/.test(c))) return ""; // separator row
    const tds = cells.map((c) => `<td class="px-3 py-1.5 border border-border text-xs">${c.trim()}</td>`).join("");
    return `<tr>${tds}</tr>`;
  });
  html = html.replace(/(<tr>.*?<\/tr>\n?)+/g, (m) => `<table class="w-full border-collapse my-2"><tbody>${m}</tbody></table>`);

  // Line breaks (preserve paragraphs)
  html = html.replace(/\n\n/g, '</p><p class="text-sm text-foreground/80 mb-2">');
  html = `<div class="docs-content"><p class="text-sm text-foreground/80 mb-2">${html}</p></div>`;

  return html;
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
  const [copied, setCopied] = useState(false);

  const rawContent = fixNewlines((r as Record<string, string | undefined>)[active] || "");

  function copy() {
    navigator.clipboard.writeText(rawContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <SectionEditor section="docs" title="Tai Lieu" content={r} onSaved={reload} />

      {/* Tab buttons */}
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

      {/* Content */}
      <div className="bg-[#060b14] border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-2 bg-[#0c1322] border-b border-border">
          <span className="text-xs text-muted-foreground font-mono">
            {TABS.find((t) => t.id === active)?.name}
          </span>
          <button
            onClick={copy}
            className="flex items-center gap-1 text-[11px] text-muted-foreground border border-border px-2 py-0.5 rounded hover:border-primary hover:text-primary transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {/* Rendered markdown */}
        {rawContent ? (
          <div
            className="px-5 py-4 overflow-x-auto nexus-scroll min-h-[200px] docs-rendered"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(rawContent) }}
          />
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            Khong co du lieu
          </div>
        )}
      </div>
    </div>
  );
}
