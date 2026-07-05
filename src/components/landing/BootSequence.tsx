"use client";

import { useState, useEffect } from "react";

const BOOT_STEPS = [
  { label: "INITIALIZING NEXUS CORE", detail: "Loading AI kernel v2.5..." },
  { label: "CALIBRATING NEURAL NETWORK", detail: "1.2B parameters loaded" },
  { label: "CONNECTING AI AGENTS", detail: "10 agents online" },
  { label: "LOADING KNOWLEDGE BASE", detail: "Syncing 847 documents" },
  { label: "ESTABLISHING QUANTUM LINK", detail: "Entanglement stable" },
  { label: "ACTIVATING HOLOGRAPHIC UI", detail: "Rendering interface" },
  { label: "LAUNCHING NEXUS", detail: "Welcome to the future" },
];

export function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const totalSteps = BOOT_STEPS.length;
    const stepDuration = 600;
    const interval = setInterval(() => {
      setStepIndex((prev) => {
        const next = prev + 1;
        if (next >= totalSteps) {
          clearInterval(interval);
          setTimeout(() => {
            setDone(true);
            setTimeout(onComplete, 800);
          }, 400);
          return prev;
        }
        return next;
      });
    }, stepDuration);

    const progressInterval = setInterval(() => {
      setProgress((p) => {
        const next = p + 100 / (totalSteps * (stepDuration / 50));
        return next >= 100 ? 100 : next;
      });
    }, 50);

    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[10000] bg-[#060b14] flex items-center justify-center transition-opacity duration-700 ${
        done ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Grid background */}
      <div className="absolute inset-0 nexus-futuristic-grid opacity-30" />
      {/* Aurora */}
      <div className="absolute inset-0 nexus-aurora opacity-40" />

      {/* Central content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6">
        {/* Rotating rings */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          <div className="absolute w-32 h-32 rounded-full border border-primary/20 nexus-slow-spin" style={{ borderTopColor: "rgba(0,212,170,0.5)" }} />
          <div className="absolute w-24 h-24 rounded-full border border-cyan-400/20 nexus-slow-spin" style={{ animationDuration: "15s", animationDirection: "reverse", borderRightColor: "rgba(56,189,248,0.4)" }} />
          <div className="absolute w-16 h-16 rounded-full border border-emerald-400/20 nexus-slow-spin" style={{ animationDuration: "10s", borderBottomColor: "rgba(16,185,129,0.4)" }} />
          <div className="absolute w-8 h-8 rounded-full bg-primary/20 blur-md nexus-pulse-ring" />
          <div className="absolute w-4 h-4 rounded-full bg-primary nexus-neon-glow" />
        </div>

        {/* NEXUS AI */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-[0.3em] nexus-holo-text">NEXUS AI</h1>
          <p className="text-[10px] text-muted-foreground tracking-[0.5em] uppercase mt-2">Multi-Agent Intelligence</p>
        </div>

        {/* Progress bar */}
        <div className="w-80 max-w-full">
          <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground mb-2">
            <span className="text-primary">SYSTEM BOOT</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 bg-primary/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-100"
              style={{ width: `${progress}%`, boxShadow: "0 0 10px rgba(0,212,170,0.6)" }}
            />
          </div>
        </div>

        {/* Boot steps */}
        <div className="h-24 w-80 max-w-full space-y-1">
          {BOOT_STEPS.slice(Math.max(0, stepIndex - 2), stepIndex + 1).map((step, i, arr) => {
            const isCurrent = i === arr.length - 1;
            const isDone = i < arr.length - 1;
            return (
              <div key={step.label} className={`flex items-center gap-2 nexus-boot-text transition-opacity ${isCurrent ? "opacity-100" : "opacity-40"}`}>
                <span className={isDone ? "text-emerald-400" : isCurrent ? "text-primary nexus-blink" : ""}>
                  {isDone ? "✓" : "▸"}
                </span>
                <span className="flex-1 truncate">{step.label}</span>
                <span className="text-muted-foreground/50 text-[9px]">{step.detail}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
