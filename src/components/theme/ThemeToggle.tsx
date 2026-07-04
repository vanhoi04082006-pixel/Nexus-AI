"use client";

/* eslint-disable react-hooks/set-state-in-effect -- next-themes requires a
   mounted guard (setState in effect) to avoid hydration mismatch. This is the
   documented official pattern and is safe (runs once on mount). */

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";

interface ThemeToggleProps {
  /** Compact mode renders just the icon button (good for tight headers) */
  compact?: boolean;
  /** Optional className passthrough */
  className?: string;
}

/**
 * Theme toggle for the NEXUS AI app.
 * - Cycles: dark → light → dark
 * - Shows a skeleton until mounted to avoid hydration mismatch
 * - Persists choice via next-themes (localStorage key: "theme")
 */
export function ThemeToggle({ compact = false, className = "" }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Standard next-themes mount guard — prevents hydration mismatch because
  // the theme is only known on the client.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch — render a stable placeholder until mounted
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Đang tải chế độ giao diện"
        className={`w-9 h-9 rounded-lg bg-card/40 border border-border/40 flex items-center justify-center ${className}`}
      >
        <span className="w-4 h-4 rounded-full bg-muted-foreground/30 animate-pulse" />
      </button>
    );
  }

  const isDark = (resolvedTheme || theme) === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Chuyển sang chế độ Sáng" : "Chuyển sang chế độ Tối"}
      title={isDark ? "Chế độ Sáng" : "Chế độ Tối"}
      className={`group relative w-9 h-9 rounded-lg bg-card/40 border border-border/40 flex items-center justify-center hover:border-primary/40 hover:bg-primary/10 transition-all overflow-hidden ${className}`}
    >
      {/* Sun icon (shown in dark mode → click to go light) */}
      <Sun
        className={`w-4 h-4 text-amber-400 absolute transition-all duration-300 ${
          isDark
            ? "opacity-100 rotate-0 scale-100"
            : "opacity-0 -rotate-90 scale-0"
        }`}
      />
      {/* Moon icon (shown in light mode → click to go dark) */}
      <Moon
        className={`w-4 h-4 text-primary absolute transition-all duration-300 ${
          isDark
            ? "opacity-0 rotate-90 scale-0"
            : "opacity-100 rotate-0 scale-100"
        }`}
      />
      {/* Glow ring on hover */}
      <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-primary/5 pointer-events-none" />
    </button>
  );
}

/**
 * Larger segmented toggle — dark / light buttons side by side.
 * Useful in settings panels or sidebar footers.
 */
export function ThemeToggleSegmented({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = mounted ? (resolvedTheme || theme || "dark") : "dark";

  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-lg bg-card/40 border border-border/40 ${className}`}
      role="group"
      aria-label="Chọn chế độ giao diện"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={current === "light"}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
          current === "light"
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
        }`}
      >
        <Sun className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Sáng</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={current === "dark"}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
          current === "dark"
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
        }`}
      >
        <Moon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Tối</span>
      </button>
    </div>
  );
}
