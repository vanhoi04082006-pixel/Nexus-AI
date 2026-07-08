"use client";

/**
 * error.tsx — Next.js App Router error boundary.
 *
 * Catches unhandled errors in the route segment (including during
 * server component rendering). Shows a friendly retry UI.
 * This complements the React <ErrorBoundary> in layout.tsx.
 */

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RouteError]", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-destructive/30 rounded-xl p-6 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-bold mb-1">Trang gặp lỗi</h2>
          <p className="text-sm text-muted-foreground">
            Có lỗi xảy ra khi tải trang. Bạn có thể thử lại hoặc về trang chủ.
          </p>
        </div>
        <details className="text-left text-xs bg-secondary/30 rounded-lg p-3">
          <summary className="cursor-pointer text-muted-foreground font-medium">
            Chi tiết lỗi
          </summary>
          <pre className="mt-2 whitespace-pre-wrap break-all text-destructive/80">
            {error.message || "Unknown error"}
            {error.digest ? `\nDigest: ${error.digest}` : ""}
          </pre>
        </details>
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Thử lại
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            <Home className="w-4 h-4" /> Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}
