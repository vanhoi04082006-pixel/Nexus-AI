import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { NeuralBackground } from "@/components/nexus/NeuralBackground";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NEXUS AI - Multi-Agent Project Architect",
  description: "8 AI Agents phan tich, thiet ke va quan ly du an. Lap ke hoach, phan nhan su, sinh todolist chi tiet cho tung thanh vien.",
  keywords: ["NEXUS AI", "Multi-Agent", "Project Planning", "UML", "Sprint", "Todolist"],
  authors: [{ name: "NEXUS AI" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Mermaid.js via CDN for reliable UML rendering.
            Theme-aware: re-initializes with light/dark palette whenever
            the document theme class changes (next-themes toggles .dark on <html>). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function mermaidThemeVars(isDark) {
                  if (isDark) {
                    return {
                      theme: 'dark',
                      v: {
                        primaryColor: '#131d2e',
                        primaryTextColor: '#e2e8f0',
                        primaryBorderColor: '#00d4aa',
                        lineColor: '#00d4aa',
                        secondaryColor: '#1e2d42',
                        tertiaryColor: '#0c1322',
                        background: '#0c1322',
                        mainBkg: '#131d2e',
                        nodeBorder: '#00d4aa',
                        clusterBkg: '#0c1322',
                        titleColor: '#00d4aa',
                        edgeLabelBackground: '#131d2e',
                        actorBkg: '#131d2e',
                        actorBorder: '#00d4aa',
                        actorTextColor: '#e2e8f0',
                        signalColor: '#e2e8f0',
                        noteBkgColor: '#1e2d42',
                        noteBorderColor: '#00d4aa',
                        noteTextColor: '#e2e8f0',
                        classText: '#e2e8f0'
                      }
                    };
                  }
                  return {
                    theme: 'default',
                    v: {
                      primaryColor: '#f1f5f9',
                      primaryTextColor: '#0f172a',
                      primaryBorderColor: '#00b894',
                      lineColor: '#00b894',
                      secondaryColor: '#e2e8f0',
                      tertiaryColor: '#f6f8fb',
                      background: '#ffffff',
                      mainBkg: '#f1f5f9',
                      nodeBorder: '#00b894',
                      clusterBkg: '#f6f8fb',
                      titleColor: '#00b894',
                      edgeLabelBackground: '#ffffff',
                      actorBkg: '#f1f5f9',
                      actorBorder: '#00b894',
                      actorTextColor: '#0f172a',
                      signalColor: '#0f172a',
                      noteBkgColor: '#e2e8f0',
                      noteBorderColor: '#00b894',
                      noteTextColor: '#0f172a',
                      classText: '#0f172a'
                    }
                  };
                }
                function isDarkMode() {
                  return document.documentElement.classList.contains('dark');
                }
                function applyMermaidTheme() {
                  if (!window.mermaid) return;
                  var cfg = mermaidThemeVars(isDarkMode());
                  window.mermaid.initialize({
                    startOnLoad: false,
                    theme: cfg.theme,
                    themeVariables: cfg.v,
                    flowchart: { curve: 'basis', padding: 20 },
                    sequence: { mirrorActors: false }
                  });
                  window.__mermaidReady = true;
                  window.dispatchEvent(new Event('mermaid-ready'));
                  window.dispatchEvent(new Event('mermaid-theme-changed'));
                }
                window.__applyMermaidTheme = applyMermaidTheme;
                window.addEventListener('DOMContentLoaded', function() {
                  var s = document.createElement('script');
                  s.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
                  s.onload = function() { applyMermaidTheme(); };
                  document.head.appendChild(s);
                });
                // Re-apply when theme toggles (next-themes updates the class on <html>)
                var obs = new MutationObserver(function() {
                  if (window.mermaid) applyMermaidTheme();
                });
                obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          {/* Sci-fi neural network background — living AI brain visualization */}
          <NeuralBackground />
          {/* Content above background */}
          <div className="relative z-10">
            {children}
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
