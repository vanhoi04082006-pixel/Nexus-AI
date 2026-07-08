"use client";

import { useEffect, useRef, useState } from "react";
import { useNexus } from "@/store/useNexus";

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

    // CRITICAL: Fix "A -->|label| B : text" → "A -->|label| B"
    // Mermaid classDiagram does NOT support ": label" after a relationship with |edge label|
    // Example: RecommendationEngine -->|use| Product : "analyzes" → RecommendationEngine -->|use| Product
    s = s.replace(
      /^(\s*)(\w+)\s*(--?>|<--|--|-\.\->|<-\.\-)\s*\|([^|]+)\|\s*(\w+)\s*:\s*.*$/gm,
      (_m, indent: string, from: string, arrow: string, edgeLabel: string, to: string) => {
        return `${indent}${from} ${arrow}|${edgeLabel}| ${to}`;
      }
    );

    // CRITICAL: Fix "A -->|label| B" (no trailing text) → "A --> B : label"
    // The |label| edge-label syntax is from sequence diagrams, NOT valid in classDiagram.
    // In classDiagram, labels go after a colon: A --> B : label
    // Example: Role -->|use| Permission → Role --> Permission : use
    s = s.replace(
      /^(\s*)(\w+)\s*(--?>|<--|--|-\.\->|<-\.\-)\s*\|([^|]+)\|\s*(\w+)\s*$/gm,
      (_m, indent: string, from: string, arrow: string, edgeLabel: string, to: string) => {
        return `${indent}${from} ${arrow} ${to} : ${edgeLabel.trim()}`;
      }
    );

    // CRITICAL: Fix 'A "1" --> "*" B : "label"' → 'A "1" --> "*" B : label'
    // Mermaid 11 sometimes chokes on quoted labels after colon in classDiagram
    // Strip quotes from the relationship label (keep the text)
    // Example: Customer "1" --> "*" Cart : "has" → Customer "1" --> "*" Cart : has
    s = s.replace(
      /^(\s*)(\w+)\s+("[^"]*")\s*(--?>|<--|--|-\.\->)\s*("[^"]*")\s*(\w+)\s*:\s*"([^"]*)"\s*$/gm,
      (_m, indent: string, from: string, card1: string, arrow: string, card2: string, to: string, label: string) => {
        return `${indent}${from} ${card1} ${arrow} ${card2} ${to} : ${label}`;
      }
    );

    // Fix <<entity>> stereotype syntax (Mermaid wants <<entity>> on its own line inside class)
    // AI writes: class User { <<entity>> +int id ... }
    // Mermaid wants: class User { <<entity>> \n +int id \n ... }
    s = s.replace(
      /\{(\s*)<<(entity|abstract|interface|enum|service)>>\s+/g,
      "{ $1<<$2>>\n"
    );

    // Fix "class ClassName {" that has content on same line — split to next line
    s = s.replace(
      /class\s+(\w+)\s*\{(\s*)(\+)/g,
      "class $1 {\n  $3"
    );
  }

  // ===== Use Case (graph TD) fixes =====
  // AI often writes invalid use-case syntax like:
  //   actor["System Admin"] --> (ManageBranches)
  //   actorFoo["Name"] --> (UseCase)
  //   Register --> Login : include
  //   EnrollCourse --> PaymentProcess : extend
  // Mermaid graph TD does NOT support parens () as use-case nodes, nor does
  // it support "A --> B : label" syntax (the colon is invalid).
  // Fixes:
  //   (UseCaseName) → UseCaseName["UseCase Name"]
  //   A --> B : include → A -->|include| B
  //   A --> B : extend → A -.->|extend| B
  if (s.includes("graph TD") || s.includes("graph LR")) {
    // CRITICAL: Sanitize node IDs with Vietnamese diacritics / spaces / special chars.
    // Mermaid requires node IDs to match [A-Za-z0-9_] — no accents, no spaces.
    // AI generates: "Bệnh nhân["Bệnh nhân"] --> ĐăngKý["Đăng ký"]"
    // We convert:  "BenhNhan["Bệnh nhân"] --> DangKy["Đăng ký"]"
    // Map of Vietnamese chars → ASCII equivalents
    const vietMap: Record<string, string> = {
      "à":"a","á":"a","ạ":"a","ả":"a","ã":"a","â":"a","ầ":"a","ấ":"a","ậ":"a","ẩ":"a","ẫ":"a",
      "ă":"a","ằ":"a","ắ":"a","ặ":"a","ẳ":"a","ẵ":"a",
      "è":"e","é":"e","ẹ":"e","ẻ":"e","ẽ":"e","ê":"e","ề":"e","ế":"e","ệ":"e","ể":"e","ễ":"e",
      "ì":"i","í":"i","ị":"i","ỉ":"i","ĩ":"i",
      "ò":"o","ó":"o","ọ":"o","ỏ":"o","õ":"o","ô":"o","ồ":"o","ố":"o","ộ":"o","ổ":"o","ỗ":"o",
      "ơ":"o","ờ":"o","ớ":"o","ợ":"o","ở":"o","ỡ":"o",
      "ù":"u","ú":"u","ụ":"u","ủ":"u","ũ":"u","ư":"u","ừ":"u","ứ":"u","ự":"u","ử":"u","ữ":"u",
      "ỳ":"y","ý":"y","ỵ":"y","ỷ":"y","ỹ":"y",
      "đ":"d",
      "À":"A","Á":"A","Ạ":"A","Ả":"A","Ã":"A","Â":"A","Ầ":"A","Ấ":"A","Ậ":"A","Ẩ":"A","Ẫ":"A",
      "Ă":"A","Ằ":"A","Ắ":"A","Ặ":"A","Ẳ":"A","Ẵ":"A",
      "È":"E","É":"E","Ẹ":"E","Ẻ":"E","Ẽ":"E","Ê":"E","Ề":"E","Ế":"E","Ệ":"E","Ể":"E","Ễ":"E",
      "Ì":"I","Í":"I","Ị":"I","Ỉ":"I","Ĩ":"I",
      "Ò":"O","Ó":"O","Ọ":"O","Ỏ":"O","Õ":"O","Ô":"O","Ồ":"O","Ố":"O","Ộ":"O","Ổ":"O","Ỗ":"O",
      "Ơ":"O","Ờ":"O","Ớ":"O","Ợ":"O","Ở":"O","Ỡ":"O",
      "Ù":"U","Ú":"U","Ụ":"U","Ủ":"U","Ũ":"U","Ư":"U","Ừ":"U","Ứ":"U","Ự":"U","Ử":"U","Ữ":"U",
      "Ỳ":"Y","Ý":"Y","Ỵ":"Y","Ỷ":"Y","Ỹ":"Y",
      "Đ":"D",
    };
    const sanitizeId = (id: string): string => {
      let result = "";
      for (const ch of id) {
        result += vietMap[ch] ?? ch;
      }
      // Remove spaces, hyphens, slashes, dots → CamelCase
      result = result.replace(/[\s\-/.]+(.)/g, (_m, c: string) => c.toUpperCase());
      result = result.replace(/[\s\-/.]/g, "");
      // Replace any remaining non-alphanumeric chars
      result = result.replace(/[^A-Za-z0-9_]/g, "");
      return result || "Node";
    };

    // Fix node IDs that contain Vietnamese chars or spaces BEFORE the [ or -->
    // Pattern: "Bệnh nhân[" → "BenhNhan["
    // Pattern: "Bệnh nhân -->" → "BenhNhan -->"
    // Pattern: "Bệnh nhân" (standalone) → "BenhNhan"
    // CRITICAL: Skip declaration lines (graph TD, classDiagram, etc.)
    const graphLines = s.split("\n");
    s = graphLines.map((line) => {
      const trimmed = line.trim();
      // Skip declaration lines — don't sanitize IDs on them
      if (/^(graph\s|flowchart\s|classDiagram|erDiagram|sequenceDiagram|subgraph\s|end\s*$|classDef\s|style\s|%%)/.test(trimmed)) {
        return line;
      }
      return line.replace(
        /^(\s*)([\p{L}\p{M}\s\-/.]+?)(\s*(?:\["|"|-->|---|-\.->|$))/u,
        (_m, indent: string, id: string, rest: string) => {
          const cleanId = id.trim();
          // Only sanitize if the ID contains non-ASCII chars or spaces
          if (/[^A-Za-z0-9_]/.test(cleanId)) {
            return `${indent}${sanitizeId(cleanId)}${rest}`;
          }
          return _m;
        }
      );
    }).join("\n");

    // CRITICAL: Fix "A --> B : include" and "A --> B : extend" syntax
    // Must run BEFORE the parens fixer to avoid conflicts.
    // Pattern: NodeId["label"] --> NodeId2["label2"] : include/extend
    // Also handles: NodeId --> NodeId2 : include/extend
    // Also handles: NodeId["label"] --> NodeId2 : include/extend
    s = s.replace(
      /^(\s*)(\w+(?:\["[^"]*"\])?)\s*(--?>|-\.\->)\s*(\w+(?:\["[^"]*"\])?)\s*:\s*(include|extend|«include»|«extend»)\s*$/gmi,
      (_m, indent: string, from: string, arrow: string, to: string, label: string) => {
        const cleanLabel = label.replace(/«|»/g, "").toLowerCase().trim();
        if (cleanLabel === "extend") {
          return `${indent}${from} -.->|${cleanLabel}| ${to}`;
        }
        return `${indent}${from} -->|${cleanLabel}| ${to}`;
      }
    );

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

function waitForMermaid(timeoutMs = 10000): Promise<NonNullable<typeof window.mermaid>> {
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

/**
 * Aggressive fix — used on retry when fixMermaid() still fails.
 * Strips ALL problematic syntax to maximize the chance of Mermaid
 * rendering successfully, even if the diagram looks simpler.
 */
function aggressiveFix(s: string): string {
  let out = s;
  // 1. Remove all edge labels with |...| syntax (common cause of syntax errors)
  out = out.replace(/(-+>|<--|-+|\.+>+)\|[^|]*\|/g, "$1");
  // 2. Remove all relationship labels after colons (A --> B : label → A --> B)
  out = out.replace(/^(\s*\S+.*?(?:-->|---|-\.->|<--)\s*\S+)\s*:\s*.+$/gm, "$1");
  // 3. Remove cardinality quotes (A "1" --> "*" B → A --> B)
  out = out.replace(/"[^"]*"\s*(-->|---|<--|-\.->)\s*"[^"]*"/g, "$1");
  // 4. Ensure all node labels in [...] are double-quoted
  out = out.replace(/\[([^\]"'][^\]]*)\]/g, '["$1"]');
  // 5. Remove subgraph ... end blocks (they sometimes cause issues)
  // (keep it — just ensure "end" is on its own line)
  out = out.replace(/^\s*end\s*$/gim, "end");
  // 6. Remove any remaining special chars from node IDs (keep only [A-Za-z0-9_])
  // This runs per-line for graph/classDiagram/erDiagram
  const lines = out.split("\n");
  const fixedLines = lines.map((line) => {
    const trimmed = line.trim();
    // Skip declaration lines
    if (/^(graph|flowchart|classDiagram|erDiagram|sequenceDiagram|subgraph|end|classDef|style|%%)/.test(trimmed)) {
      return line;
    }
    // For lines with node definitions or relationships, sanitize IDs
    // Match: ID["label"] or ID[label] or ID --> ID
    return line.replace(/^(\s*)([^\s\[\]{}()"'|:<>-]+)/, (_m, indent: string, id: string) => {
      const cleanId = id.replace(/[^A-Za-z0-9_]/g, "");
      return `${indent}${cleanId || "Node"}`;
    });
  });
  out = fixedLines.join("\n");
  // 7. Remove empty lines (Mermaid sometimes chokes on them)
  out = out.replace(/^\s*$/gm, "");
  return out.trim();
}

export function MermaidRenderer({ code, id }: { code: string; id: string }) {
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [lastFixedCode, setLastFixedCode] = useState<string>("");
  const [aiFixing, setAiFixing] = useState(false);
  const [aiFixedCode, setAiFixedCode] = useState<string | null>(null);
  const renderToken = useRef(0);

  useEffect(() => {
    const myToken = ++renderToken.current;
    let cancelled = false;

    async function render() {
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

        // Determine which code to use:
        // - aiFixedCode (if AI already fixed it)
        // - aggressiveFix(fixMermaid(code)) on retry >= 1
        // - fixMermaid(code) on first attempt
        let fixed: string;
        if (aiFixedCode) {
          fixed = aiFixedCode;
        } else {
          fixed = fixMermaid(code);
          if (retryCount >= 1) {
            fixed = aggressiveFix(fixed);
          }
        }
        setLastFixedCode(fixed);

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
        const errMsg = e instanceof Error ? e.message : "Loi render";
        setError(errMsg);
        setLoading(false);

        // AUTO AI FIX: When aggressiveFix fails (retry >= 1) and we haven't
        // tried AI yet, automatically call the AI Mermaid fixer
        if (retryCount >= 1 && !aiFixedCode && !aiFixing && projectId && token) {
          setAiFixing(true);
          try {
            const diagramType = code.includes("graph TD") || code.includes("graph LR")
              ? "useCase"
              : code.includes("classDiagram")
              ? "classDiagram"
              : code.includes("erDiagram")
              ? "erd"
              : code.includes("sequenceDiagram")
              ? "sequence"
              : "unknown";

            const resp = await fetch(
              `/api/projects/${projectId}/fix-mermaid?token=${encodeURIComponent(token)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, error: errMsg, diagramType }),
              }
            );
            if (resp.ok) {
              const data = await resp.json();
              if (data.fixedCode) {
                setAiFixedCode(data.fixedCode);
                // Trigger re-render with AI-fixed code
                setRetryCount((c) => c + 1);
                return;
              }
            }
          } catch {
            // AI fix failed — user can still manually retry
          } finally {
            setAiFixing(false);
          }
        }
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [code, id, retryCount, aiFixedCode, projectId, token, aiFixing]);

  function downloadSVG() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${id}-diagram.svg`;
    a.click();
    // FIX: Delay revoke — Firefox hasn't started download yet when URL is revoked
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      {aiFixing && (
        <div className="text-primary text-sm mb-3 flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          AI đang sửa diagram...
        </div>
      )}
      {error && !aiFixing && (
        <>
          <div className="text-destructive text-sm mb-2">Loi render Mermaid: {error}</div>
          {code && code.trim() ? (
            <>
              {retryCount === 0 && (
                <p className="text-[11px] text-muted-foreground mb-3">
                  Bấm "Thử lại" để áp dụng bộ sửa lỗi nâng cao + AI auto-fix.
                </p>
              )}
              {retryCount > 0 && !aiFixedCode && (
                <p className="text-[11px] text-amber-400 mb-3">
                  Đã thử {retryCount} lần. Bấm "Thử lại" để AI sửa diagram.
                </p>
              )}
              {aiFixedCode && (
                <p className="text-[11px] text-amber-400 mb-3">
                  AI đã sửa nhưng vẫn lỗi — diagram có thể quá phức tạp. Thử edit section.
                </p>
              )}
              <button
                onClick={() => {
                  setRetryCount((c) => c + 1);
                }}
                className="mb-3 px-3 py-1 text-xs border border-primary text-primary rounded hover:bg-primary/10 transition-colors"
              >
                ↻ Thu lai {retryCount > 0 && `(${retryCount})`}
              </button>
            </>
          ) : (
            <p className="text-[11px] text-amber-400 mb-3">
              Không có dữ liệu diagram. Agent UML có thể chưa sinh diagram — thử chạy lại pipeline hoặc edit section này.
            </p>
          )}
          <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap max-h-64 overflow-auto nexus-scroll w-full">
            {lastFixedCode || code}
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
