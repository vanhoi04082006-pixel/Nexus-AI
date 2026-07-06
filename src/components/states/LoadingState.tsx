"use client";

/**
 * LoadingState — Reusable skeleton loading state.
 *
 * Shows animated placeholder skeletons while data is loading.
 * Supports a `variant` prop for common layouts.
 *
 * Usage:
 *   {loading ? <LoadingState variant="cards" /> : <Data />}
 */

import { memo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Variant = "cards" | "list" | "table" | "text" | "default";

interface LoadingStateProps {
  variant?: Variant;
  count?: number;
  className?: string;
}

function LoadingStateImpl({
  variant = "default",
  count = 3,
  className = "",
}: LoadingStateProps) {
  if (variant === "cards") {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`} aria-busy="true">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={`space-y-3 ${className}`} aria-busy="true">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={`bg-card border border-border rounded-xl overflow-hidden ${className}`} aria-busy="true">
        <div className="bg-secondary/30 px-4 py-2.5 flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="px-4 py-2.5 flex gap-4 border-t border-border/50">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === "text") {
    return (
      <div className={`space-y-2 ${className}`} aria-busy="true">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    );
  }

  // default: centered spinner-like skeleton
  return (
    <div className={`flex flex-col items-center justify-center py-10 space-y-3 ${className}`} aria-busy="true">
      <Skeleton className="h-10 w-10 rounded-full" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export const LoadingState = memo(LoadingStateImpl);
LoadingState.displayName = "LoadingState";
