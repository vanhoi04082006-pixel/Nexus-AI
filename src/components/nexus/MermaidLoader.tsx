"use client";

/**
 * MermaidLoader — Client component that loads Mermaid.js from CDN
 * and initializes it with NEXUS AI theme.
 *
 * Must be a Client Component because:
 * 1. Uses useEffect (browser-only API)
 * 2. Registers event listeners on window
 *
 * Usage in layout.tsx (Server Component):
 *   <MermaidLoader />
 */

import { useEffect } from "react";

export function MermaidLoader() {
  useEffect(() => {
    // Skip if already loaded
    if (window.__mermaidReady) return;

    const existing = document.querySelector('script[data-mermaid]') as HTMLScriptElement | null;
    if (existing) {
      // Script tag exists but may not be loaded yet — wait for it
      if (window.mermaid) {
        initMermaid();
      } else {
        existing.addEventListener("load", initMermaid);
      }
      return;
    }

    // Create and append script
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    script.integrity = "sha384-T/0lMUdJpd2S1ZHtRiofG3htU3xPCrFVeAQ1UUE2TJwlEJSV5NUwn30kP28n238E";
    script.crossOrigin = "anonymous";
    script.async = true;
    script.setAttribute("data-mermaid", "true");
    script.addEventListener("load", initMermaid);
    document.head.appendChild(script);

    function initMermaid() {
      if (!window.mermaid) return;
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          primaryColor: "#131d2e",
          primaryTextColor: "#e2e8f0",
          primaryBorderColor: "#00d4aa",
          lineColor: "#00d4aa",
          secondaryColor: "#1e2d42",
          tertiaryColor: "#0c1322",
          background: "#0c1322",
          mainBkg: "#131d2e",
          nodeBorder: "#00d4aa",
          clusterBkg: "#0c1322",
          titleColor: "#00d4aa",
          edgeLabelBackground: "#131d2e",
          actorBkg: "#131d2e",
          actorBorder: "#00d4aa",
          actorTextColor: "#e2e8f0",
          signalColor: "#e2e8f0",
          noteBkgColor: "#1e2d42",
          noteBorderColor: "#00d4aa",
          noteTextColor: "#e2e8f0",
          classText: "#e2e8f0",
        },
        flowchart: { curve: "basis", padding: 20 },
        sequence: { mirrorActors: false },
      });
      window.__mermaidReady = true;
      window.dispatchEvent(new Event("mermaid-ready"));
    }

    return () => {
      // Cleanup: remove event listener (don't remove script — it may be reused)
      script.removeEventListener("load", initMermaid);
    };
  }, []);

  return null; // This component renders nothing — just loads the script
}
