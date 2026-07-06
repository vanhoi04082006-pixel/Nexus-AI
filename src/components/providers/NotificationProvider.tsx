"use client";

/**
 * NotificationProvider — Standardized toast notification system.
 *
 * Wraps Sonner with a typed API so all toasts are consistent:
 *   notify.success(msg) / notify.error(msg) / notify.warning(msg)
 *   notify.info(msg)    / notify.loading(msg) / notify.copy(msg)
 *   notify.promise(p, opts) / notify.dismiss(id)
 *
 * Auto-configures Sonner with theme, position, rich colors, icons,
 * queue management, and stacking rules.
 *
 * Usage in any client component:
 *   import { notify } from "@/lib/notify";
 *   notify.success("Luu thanh cong!");
 */

import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2, Copy } from "lucide-react";
import { memo } from "react";

function NotificationProviderImpl() {
  return (
    <Sonner
      position="bottom-right"
      theme="dark"
      richColors
      closeButton
      expand={false}
      duration={4000}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          title: "text-sm font-semibold",
          description: "text-xs text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
          icon: "mr-2",
        },
      }}
      icons={{
        success: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
        error: <XCircle className="w-4 h-4 text-red-500" />,
        warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
        info: <Info className="w-4 h-4 text-sky-500" />,
        loading: <Loader2 className="w-4 h-4 text-primary animate-spin" />,
      }}
    />
  );
}

export const NotificationProvider = memo(NotificationProviderImpl);
NotificationProvider.displayName = "NotificationProvider";

/**
 * Typed notification API.
 * All methods return the toast id (string | number) for dismissal.
 */
export const notify = {
  /** Success toast (green) — default 4s */
  success: (msg: string, description?: string) =>
    toast.success(msg, { description, duration: 4000 }),

  /** Error toast (red) — longer 6s for readability */
  error: (msg: string, description?: string) =>
    toast.error(msg, { description, duration: 6000 }),

  /** Warning toast (amber) */
  warning: (msg: string, description?: string) =>
    toast.warning(msg, { description, duration: 5000 }),

  /** Info toast (sky blue) */
  info: (msg: string, description?: string) =>
    toast.info(msg, { description, duration: 4000 }),

  /** Loading toast with spinner — returns id, use notify.dismiss(id) or notify.update(id, ...) */
  loading: (msg: string) => toast.loading(msg, { duration: Infinity }),

  /** Copy-to-clipboard success toast with copy icon */
  copy: (msg = "Đã copy!") =>
    toast.success(msg, {
      icon: <Copy className="w-4 h-4 text-emerald-500" />,
      duration: 2000,
    }),

  /** Update an existing toast (by id) to a new state */
  update: (
    id: string | number,
    msg: string,
    type: "success" | "error" | "warning" | "info" = "success",
    description?: string
  ) => {
    const fn = toast[type] as typeof toast.success;
    fn(msg, { id, description });
  },

  /** Dismiss a toast by id, or all if no id */
  dismiss: (id?: string | number) => toast.dismiss(id),

  /**
   * Promise-based toast — auto transitions loading -> success/error.
   * Usage: notify.promise(fetchFn, { loading, success, error })
   */
  promise: <T,>(
    p: Promise<T>,
    opts: {
      loading: string;
      success: string | ((d: T) => string);
      error: string | ((e: unknown) => string);
    }
  ) =>
    toast.promise(p, {
      loading: opts.loading,
      success: opts.success,
      error: opts.error,
    }),
} as const;
