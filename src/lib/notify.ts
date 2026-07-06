"use client";

/**
 * notify.ts — Client-side notification helper.
 *
 * Thin re-export of the `notify` API from NotificationProvider.
 * Lets any client component call `notify.success(msg)` without
 * importing the React component.
 *
 * Usage:
 *   import { notify } from "@/lib/notify";
 *   notify.success("Luu thanh cong!");
 *   notify.error("Loi server", "Thu lai sau");
 *   const id = notify.loading("AI dang xu ly...");
 *   // ... later
 *   notify.update(id, "Hoan thanh!", "success");
 */

export { notify } from "@/components/providers/NotificationProvider";
