"use client"

import { Toaster as Sonner } from "sonner"

const Toaster = () => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      richColors={false}
      closeButton
      toastOptions={{
        style: {
          background: "var(--popover)",
          border: "1px solid var(--border)",
          color: "var(--popover-foreground)",
          fontSize: "13px",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,212,170,0.08)",
        },
        classNames: {
          toast: "nexus-toast",
          title: "font-medium",
          description: "text-muted-foreground",
          success: "!border-emerald-500/30 !bg-emerald-950/40",
          error: "!border-red-500/30 !bg-red-950/40",
          warning: "!border-amber-500/30 !bg-amber-950/40",
          info: "!border-cyan-500/30 !bg-cyan-950/40",
        },
      }}
    />
  )
}

export { Toaster }
