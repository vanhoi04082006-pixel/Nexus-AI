import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { NeuralBackground } from "@/components/nexus/NeuralBackground";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
  description: "10 AI Agents phan tich, thiet ke va quan ly du an. Lap ke hoach, phan nhan su, sinh todolist chi tiet cho tung thanh vien.",
  keywords: ["NEXUS AI", "Multi-Agent", "Project Planning", "UML", "Sprint", "Todolist"],
  authors: [{ name: "NEXUS AI" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground dark`}
        suppressHydrationWarning
      >
        {/* Mermaid.js via Next.js Script (was dangerouslySetInnerHTML → removeChild error) */}
        <Script
          src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"
          integrity="sha384-T/0lMUdJpd2S1ZHtRiofG3htU3xPCrFVeAQ1UUE2TJwlEJSV5NUwn30kP28n238E"
          crossOrigin="anonymous"
          strategy="afterInteractive"
          onLoad={() => {
            if (window.mermaid) {
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
          }}
        />
        {/* Sci-fi neural network background — living AI brain visualization */}
        <NeuralBackground />
        {/* Content above background — wrapped with ErrorBoundary */}
        <div className="relative z-10">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
