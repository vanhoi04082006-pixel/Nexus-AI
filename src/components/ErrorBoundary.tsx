"use client";

/**
 * ErrorBoundary — Global React error boundary.
 *
 * Catches render errors in child subtrees, shows a friendly fallback
 * UI with retry button, and logs the error to console (could be sent
 * to a monitoring service in production).
 *
 * Usage in layout.tsx:
 *   <ErrorBoundary>{children}</ErrorBoundary>
 */

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Custom fallback render. If not provided, uses default UI. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console — in production, send to Sentry/Datadog/etc.
    console.error("[ErrorBoundary] Caught render error:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return <DefaultFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-destructive/30 rounded-xl p-6 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-bold mb-1">Ứng dụng gặp lỗi</h2>
          <p className="text-sm text-muted-foreground">
            Một thành phần đã crash. Bạn có thể thử lại hoặc về trang chủ.
          </p>
        </div>
        <details className="text-left text-xs bg-secondary/30 rounded-lg p-3">
          <summary className="cursor-pointer text-muted-foreground font-medium">
            Chi tiết lỗi
          </summary>
          <pre className="mt-2 whitespace-pre-wrap break-all text-destructive/80">
            {error.message}
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
