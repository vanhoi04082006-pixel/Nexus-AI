"use client";

import { useEffect, useRef, useState } from "react";

// Fix common AI mistakes in Mermaid code
function fixMermaid(code: string): string {
  if (!code) return "";
  let s = code;
  // CRITICAL: AI often returns literal \n (backslash-n) instead of real newlines.
  // Mermaid needs real newlines. Convert literal \n → actual newline.
  // Handle double-escaped first (\\n = 2 backslashes + n), then single (\n = 1 backslash + n)
  s = s.replace(/\\\\n/g, "\n");
  s = s.replace(/\\n/g, "\n");
  // Fix [("text")] → ["text"] (common AI mistake in node labels)
  s = s.replace(/\[\("([^"]*?)"\)\]/g, '["$1"]');
  s = s.replace(/\[\(("[^"]*?")\)\]/g, "[$1]");
  s = s.replace(/\(\("([^"]*?)"\)\)/g, '("$1")');
  s = s.replace(/\[\[\(/g, "[").replace(/\)\]\]/g, "]");

  // Wrap edge labels containing special chars in double quotes.
  // Mermaid edge syntax: A -->|text| B  →  A -->|"text"| B
  // Special chars that break parsing: ( ) [ ] { } | " '
  s = s.replace(/-->\|([^|]+)\|/g, (_m, label: string) => {
    const trimmed = label.trim();
    // Already quoted? skip
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return `-->|${label}|`;
    // Contains special chars? wrap in quotes
    if (/[(){}\[\]"']/.test(trimmed)) {
      return `-->|"${trimmed}"|`;
    }
    return `-->|${label}|`;
  });

  // Wrap node labels in [...] containing special chars in double quotes.
  // Only apply to lines that look like node definitions (contain --> or --- or are simple A[text] lines).
  // Skip subgraph, classDiagram, erDiagram, sequenceDiagram, etc. which use [] differently.
  const lines = s.split("\n");
  const fixedLines = lines.map((line) => {
    const trimmedLine = line.trim();
    // Skip directive lines and diagram type declarations
    if (
      trimmedLine.startsWith("subgraph") ||
      trimmedLine.startsWith("classDiagram") ||
      trimmedLine.startsWith("erDiagram") ||
      trimmedLine.startsWith("sequenceDiagram") ||
      trimmedLine.startsWith("graph") ||
      trimmedLine.startsWith("flowchart") ||
      trimmedLine.startsWith("%%") ||
      trimmedLine.startsWith("classDef") ||
      trimmedLine.startsWith("style ")
    ) {
      return line;
    }
    // Only fix [labels] on lines that have edge syntax (--> ---) or are pure node defs
    if (!trimmedLine.includes("-->") && !trimmedLine.includes("---") && !/^[A-Za-z_]\w*\[/.test(trimmedLine)) {
      return line;
    }
    // Fix [label] → ["label"] only if label has special chars and isn't already quoted
    return line.replace(/\[([^\]]+)\]/g, (_m, label: string) => {
      const t = label.trim();
      if (t.startsWith('"') && t.endsWith('"')) return `[${label}]`;
      if (/[(){}|"']/.test(t)) {
        return `["${t}"]`;
      }
      return `[${label}]`;
    });
  });
  s = fixedLines.join("\n");

  // Trim trailing whitespace per line
  s = s
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n");
  return s;
}

declare global {
  interface Window {
    mermaid?: {
      render: (id: string, code: string) => Promise<{ svg: string }>;
      parse: (code: string) => Promise<unknown>;
      initialize: (config: unknown) => void;
    };
    __mermaidReady?: boolean;
  }
}

function waitForMermaid(timeoutMs = 10000): Promise<typeof window.mermaid> {
  return new Promise((resolve, reject) => {
    if (window.__mermaidReady && window.mermaid) {
      resolve(window.mermaid);
      return;
    }
    const timer = setTimeout(() => reject(new Error("Mermaid not loaded")), timeoutMs);
    window.addEventListener("mermaid-ready", () => {
      clearTimeout(timer);
      if (window.mermaid) resolve(window.mermaid);
      else reject(new Error("Mermaid not loaded"));
    });
  });
}

export function MermaidRenderer({ code, id }: { code: string; id: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const renderToken = useRef(0);

  useEffect(() => {
    const myToken = ++renderToken.current;
    let cancelled = false;

    async function render() {
      // Reset state for this render cycle
      setSvg(null);
      setError(null);
      setLoading(true);

      if (!code) {
        setError("Khong co du lieu");
        setLoading(false);
        return;
      }
      try {
        const mermaid = await waitForMermaid();
        if (cancelled || myToken !== renderToken.current) return;
        const fixed = fixMermaid(code);
        const renderId = `m-${id}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        const result = await Promise.race([
          mermaid.render(renderId, fixed),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Render timeout (15s)")), 15000)
          ),
        ]);
        if (cancelled || myToken !== renderToken.current) return;
        const svgStr = (result as { svg: string }).svg;
        setSvg(svgStr);
        setError(null);
        setLoading(false);
      } catch (e) {
        if (cancelled || myToken !== renderToken.current) return;
        setError(e instanceof Error ? e.message : "Loi render");
        setLoading(false);
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [code, id, retryCount]);

  return (
    <div className="mermaid-container">
      {loading && !error && !svg && (
        <div className="text-muted-foreground text-sm nexus-pulse">Dang render diagram...</div>
      )}
      {error && (
        <>
          <div className="text-destructive text-sm mb-3">Loi render Mermaid: {error}</div>
          <button
            onClick={() => {
              setRetryCount((c) => c + 1);
            }}
            className="mb-3 px-3 py-1 text-xs border border-primary text-primary rounded hover:bg-primary/10 transition-colors"
          >
            ↻ Thu lai
          </button>
          <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap max-h-64 overflow-auto nexus-scroll w-full">
            {code}
          </pre>
        </>
      )}
      {svg && !error && <div dangerouslySetInnerHTML={{ __html: svg }} />}
    </div>
  );
}
