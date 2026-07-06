"use client";

/**
 * RetryState — Reusable error/retry state component.
 *
 * Shows when a fetch/load failed. Includes error message and retry button.
 *
 * Usage:
 *   {error ? <RetryState onRetry={refetch} message={error} /> : <Data />}
 */

import { memo } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";

interface RetryStateProps {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
  className?: string;
}

function RetryStateImpl({
  message = "Không thể tải dữ liệu",
  onRetry,
  retrying = false,
  className = "",
}: RetryStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-10 px-4 text-center ${className}`}
      role="alert"
    >
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6 text-destructive/70" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted-foreground mb-3 max-w-sm">{message}</p>
      <button
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
        {retrying ? "Đang thử lại..." : "Thử lại"}
      </button>
    </div>
  );
}

export const RetryState = memo(RetryStateImpl);
RetryState.displayName = "RetryState";
