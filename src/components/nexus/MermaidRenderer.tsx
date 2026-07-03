"use client";

import { useEffect, useRef, useState } from "react";

// Fix common AI mistakes in Mermaid code
function fixMermaid(code: string): string {
  if (!code) return "";
  let s = code;
  // CRITICAL: AI often returns literal \n (backslash-n) instead of real newlines.
  s = s.replace(/\\\\n/g, "\n");
  s = s.replace(/\\n/g, "\n");
  // Fix [("text")] → ["text"] (common AI mistake in node labels)
  s = s.replace(/\[\("([^"]*?)"\)\]/g, '["$1"]');
  s = s.replace(/\[\(("[^"]*?")\)\]/g, "[$1]");
  s = s.replace(/\(\("([^"]*?)"\)\)/g, '("$1")');
  s = s.replace(/\[\[\(/g, "[").replace(/\)\]\]/g, "]");

  // ===== ERD fixes =====
  if (s.includes("erDiagram")) {
    s = s.replace(/^(\s*\w+\s+\w+)\s+PK\s+FK\s*$/gm, "$1 PK");
    s = s.replace(/^(\s*\w+\s+\w+)\s+FK\s+PK\s*$/gm, "$1 PK");
    s = s.replace(/^(\s*\w+\s+\w+)\s+PK,?\s*FK\s*$/gmi, "$1 PK");
    s = s.replace(/^(\s*\w+\s+\w+)\s+FK,?\s*PK\s*$/gmi, "$1 PK");
  }

  // ===== classDiagram fixes =====
  // AI writes "class User <|-- Student" but Mermaid wants "User <|-- Student"
  // (no "class" keyword before relationship lines)
  // Also fixes "class Course "1" --> "*" Class" → 'Course "1" --> "*" Class'
  if (s.includes("classDiagram")) {
    // Remove "class " prefix from relationship lines (lines with <|--, --|>, <--, *--, o--, ..>, ..|>, -->, ---, ..)
    s = s.replace(/^(\s*)class\s+(\w+)\s+([<>*o.]+[-]+[>|*o.]+|--+|\.+[>|]+)\s*/gm, "$1$2 $3 ");
    // Remove "class " prefix from lines with cardinality: class Course "1" --> "*" Class
    s = s.replace(/^(\s*)class\s+(\w+)\s+("[^"]*"\s*[-]+[>|]*\s*"[^"]*")\s*/gm, '$1$2 $3 ');
    // Fix extra whitespace in class body (e.g. "    +int currentStudents" with leading spaces)
    s = s.replace(/^(\s*)\s{8,}(\+)/gm, "$1    $2");
  }

  // ===== Use Case (graph TD) fixes =====
  // AI often writes invalid use-case syntax like:
  //   actor["System Admin"] --> (ManageBranches)
  //   actorFoo["Name"] --> (UseCase)
  // Mermaid graph TD does NOT support parens () as use-case nodes — causes parse error.
  // Fix: convert "(UseCaseName)" → 'UseCaseName["UseCaseName"]' (valid node with label)
  // Also strip the "actor" prefix from node IDs (actor["X"] → Actor["X"]) since
  // "actor" is not a reserved word in graph TD and just looks like a node id.
  if (s.includes("graph TD") || s.includes("graph LR")) {
    // Fix "actorId["Label"] --> (UseCaseName)" → 'actorId["Label"] --> UseCaseName["UseCaseName"]'
    s = s.replace(
      /(\b\w+\["[^"]*"\]\s*--?>?\s*--?)\s*\((\w+)\)/g,
      (_m, left: string, useCaseName: string) => {
        return `${left} ${useCaseName}["${useCaseName.replace(/([A-Z])/g, " $1").trim()}"]`;
      }
    );
    // Fix standalone "(UseCaseName)" → 'UseCaseName["UseCaseName"]'
    s = s.replace(
      /(--?>?\s*--?)\s*\((\w+)\)/g,
      (_m, arrow: string, useCaseName: string) => {
        return `${arrow} ${useCaseName}["${useCaseName.replace(/([A-Z])/g, " $1").trim()}"]`;
      }
    );
    // Fix "(UseCaseName) --> (OtherUseCase)" → 'UseCaseName["UseCaseName"] --> OtherUseCase["OtherUseCase"]'
    s = s.replace(
      /^\s*\((\w+)\)\s*(-->|---)\s*\((\w+)\)\s*$/gm,
      (_m, from: string, arrow: string, to: string) => {
        const fromLabel = from.replace(/([A-Z])/g, " $1").trim();
        const toLabel = to.replace(/([A-Z])/g, " $1").trim();
        return `${from}["${fromLabel}"] ${arrow} ${to}["${toLabel}"]`;
      }
    );
  }

  // Wrap edge labels containing special chars in double quotes.
  s = s.replace(/-->\|([^|]+)\|/g, (_m, label: string) => {
    const trimmed = label.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return `-->|${label}|`;
    if (/[(){}\[\]"']/.test(trimmed)) {
      return `-->|"${trimmed}"|`;
    }
    return `-->|${label}|`;
  });

  // Wrap node labels in [...] containing special chars in double quotes.
  const lines = s.split("\n");
  const fixedLines = lines.map((line) => {
    const trimmedLine = line.trim();
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
    if (!trimmedLine.includes("-->") && !trimmedLine.includes("---") && !/^[A-Za-z_]\w*\[/.test(trimmedLine)) {
      return line;
    }
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

  // Trim trailing whitespace per line + fix excessive indentation
  s = s
    .split("\n")
    .map((line) => line.replace(/\s+$/, "").replace(/\t/g, "    "))
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

  function downloadSVG() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}-diagram.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPNG() {
    if (!svg) return;
    // Convert SVG to data URL (avoids tainted canvas from blob URL)
    const svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(2, 2);
        ctx.fillStyle = "#0c1322";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      try {
        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `${id}-diagram.png`;
        a.click();
      } catch {
        // Fallback: just download SVG
        downloadSVG();
      }
    };
    img.src = svgDataUrl;
  }

  return (
    <div className="mermaid-container flex-col">
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
      {svg && !error && (
        <>
          <div dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="flex gap-2 mt-3">
            <button
              onClick={downloadSVG}
              className="px-2.5 py-1 text-[11px] border border-border text-muted-foreground rounded hover:border-primary hover:text-primary transition-colors"
            >
              Tai SVG
            </button>
            <button
              onClick={downloadPNG}
              className="px-2.5 py-1 text-[11px] border border-border text-muted-foreground rounded hover:border-primary hover:text-primary transition-colors"
            >
              Tai PNG
            </button>
          </div>
        </>
      )}
    </div>
  );
}
