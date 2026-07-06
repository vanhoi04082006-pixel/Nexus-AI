"use client";

/**
 * global-error.tsx — Next.js root error boundary.
 *
 * Catches errors that happen in the ROOT layout itself (rare but possible).
 * Must include its own <html> and <body> tags because it replaces the root layout.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#0c1322",
          color: "#e2e8f0",
          padding: "2rem",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            background: "#131d2e",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12,
            padding: 24,
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
            Lỗi nghiêm trọng
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: 14, opacity: 0.7 }}>
            Ứng dụng gặp lỗi ở cấp root. Vui lòng tải lại trang.
          </p>
          <pre
            style={{
              margin: "0 0 16px",
              padding: 12,
              background: "rgba(255,255,255,0.05)",
              borderRadius: 8,
              fontSize: 12,
              textAlign: "left",
              overflow: "auto",
              color: "#fca5a5",
            }}
          >
            {error.message || "Unknown error"}
          </pre>
          <button
            onClick={reset}
            style={{
              padding: "8px 16px",
              background: "#00d4aa",
              color: "#0c1322",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
