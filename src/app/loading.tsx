/**
 * loading.tsx — Next.js route-level loading state.
 *
 * Shown automatically by Next.js while the route segment is loading
 * (server component fetch, chunk download). Prevents white-screen flashes.
 */

import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-nexus-bg">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm">Đang tải NEXUS AI...</p>
      </div>
    </main>
  );
}
