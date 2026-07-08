/**
 * not-found.tsx — Next.js 404 page.
 *
 * Shown when a route is not found. Keeps users in the app
 * instead of showing a generic browser 404.
 */

import Link from "next/link";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Compass className="w-8 h-8 text-primary/60" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">404</h1>
          <p className="text-sm text-muted-foreground">
            Trang bạn tìm không tồn tại hoặc đã bị di chuyển.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Home className="w-4 h-4" /> Về trang chủ
        </Link>
      </div>
    </main>
  );
}
