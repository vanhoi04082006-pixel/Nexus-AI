"use client";

import { toast } from "sonner";
import {
  CheckCircle2,
  AlertCircle,
  Info,
  XCircle,
  Copy,
  Check,
  Bell,
} from "lucide-react";
import { createElement } from "react";

/**
 * Nexus AI — Unified Notification Provider
 *
 * Usage across ALL components:
 *   import { notify } from "@/lib/notify";
 *
 *   notify.success("Đã copy!");
 *   notify.error("Lỗi kết nối");
 *   notify.info("Đang xử lý...");
 *   notify.copy();  // auto "Đã sao chép vào clipboard!"
 *   notify.loading("Đang tải...", { id: "load" });
 *   notify.dismiss("load");
 *
 * All notifications include:
 * - Icon (per type)
 * - Auto-dismiss (4s for success, 6s for error)
 * - Dark theme styling
 * - Position: bottom-right
 * - Rich text support
 */

type ToastOptions = {
  id?: string | number;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

const iconStyle = "w-4 h-4 flex-shrink-0";

export const notify = {
  success(message: string, opts?: ToastOptions) {
    toast.success(message, {
      id: opts?.id,
      description: opts?.description,
      duration: opts?.duration ?? 4000,
      icon: createElement(CheckCircle2, { className: iconStyle + " text-emerald-400" }),
    });
  },

  error(message: string, opts?: ToastOptions) {
    toast.error(message, {
      id: opts?.id,
      description: opts?.description,
      duration: opts?.duration ?? 6000,
      icon: createElement(XCircle, { className: iconStyle + " text-red-400" }),
    });
  },

  warning(message: string, opts?: ToastOptions) {
    toast.warning(message, {
      id: opts?.id,
      description: opts?.description,
      duration: opts?.duration ?? 5000,
      icon: createElement(AlertCircle, { className: iconStyle + " text-amber-400" }),
    });
  },

  info(message: string, opts?: ToastOptions) {
    toast.info(message, {
      id: opts?.id,
      description: opts?.description,
      duration: opts?.duration ?? 4000,
      icon: createElement(Info, { className: iconStyle + " text-cyan-400" }),
    });
  },

  loading(message: string, opts?: { id?: string | number }) {
    toast.loading(message, {
      id: opts?.id,
      duration: Infinity,
      icon: createElement(Bell, { className: iconStyle + " text-primary animate-pulse" }),
    });
  },

  /** Copy to clipboard with auto-notification */
  async copy(text: string, label = "Đã sao chép vào clipboard!") {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label, {
        duration: 2000,
        icon: createElement(Copy, { className: iconStyle + " text-primary" }),
      });
    } catch {
      // Fallback for older browsers / non-secure context
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        toast.success(label, {
          duration: 2000,
          icon: createElement(Copy, { className: iconStyle + " text-primary" }),
        });
      } catch {
        toast.error("Không thể sao chép — thử lại!");
      }
    }
  },

  /** Update an existing toast (e.g. loading → success) */
  update(id: string | number, message: string, type: "success" | "error" | "info" = "success") {
    const icon =
      type === "success"
        ? createElement(CheckCircle2, { className: iconStyle + " text-emerald-400" })
        : type === "error"
        ? createElement(XCircle, { className: iconStyle + " text-red-400" })
        : createElement(Info, { className: iconStyle + " text-cyan-400" });

    if (type === "success") {
      toast.success(message, { id, duration: 4000, icon });
    } else if (type === "error") {
      toast.error(message, { id, duration: 6000, icon });
    } else {
      toast.info(message, { id, duration: 4000, icon });
    }
  },

  /** Dismiss a specific toast or all */
  dismiss(id?: string | number) {
    toast.dismiss(id);
  },

  /** Promise-style notification — auto handles loading → success/error */
  promise<T>(
    promise: Promise<T>,
    opts: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    }
  ) {
    return toast.promise(promise, {
      loading: opts.loading,
      success: (data) =>
        typeof opts.success === "function" ? opts.success(data) : opts.success,
      error: (err) =>
        typeof opts.error === "function" ? opts.error(err) : opts.error,
    });
  },
};
