/**
 * error.ts — Standardized error response helper.
 *
 * In production: returns generic message (no internal details leaked).
 * In development: returns full error details for debugging.
 */

interface ErrorOptions {
  status?: number;
  /** Generic user-facing message (always returned) */
  message: string;
  /** Internal details (only returned in development) */
  details?: string;
}

export function errorResponse({ status = 500, message, details }: ErrorOptions): Response {
  const isDev = process.env.NODE_ENV === "development";
  const body: Record<string, unknown> = { error: message };
  if (isDev && details) {
    body.details = details;
  }
  return Response.json(body, { status });
}

/**
 * Wrap an async route handler with standardized error catching.
 * Usage:
 *   export const POST = safeHandler(async (req, ctx) => { ... });
 */
export function safeHandler<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (err) {
      const details = err instanceof Error ? err.message : "unknown";
      console.error("[safeHandler] Uncaught error:", err);
      return errorResponse({
        status: 500,
        message: "Lỗi server — vui lòng thử lại",
        details,
      });
    }
  };
}
