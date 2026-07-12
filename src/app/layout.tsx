import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { NeuralBackground } from "@/components/nexus/NeuralBackground";
import { MermaidLoader } from "@/components/nexus/MermaidLoader";
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
        {/* Mermaid.js loader (Client Component — loads CDN script + initializes) */}
        <MermaidLoader />
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
