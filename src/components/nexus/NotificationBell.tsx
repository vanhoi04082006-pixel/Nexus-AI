"use client";

import { useState, useEffect } from "react";
import { useNexus } from "@/store/useNexus";
import { Bell, CheckCircle2, Edit3, FileText, Rocket, RefreshCw } from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  EDIT_PROPOSAL: Edit3,
  TASK_COMPLETED: CheckCircle2,
  TASK_ASSIGNED: FileText,
  PIPELINE_DONE: Rocket,
  INIT_DONE: Rocket,
  REFINE_DONE: RefreshCw,
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "vừa xong";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export function NotificationBell() {
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  async function loadNotifications() {
    if (!projectId || !token) return;
    try {
      const resp = await fetch(`/api/projects/${projectId}/notifications?token=${encodeURIComponent(token)}`);
      if (resp.ok) {
        const data = await resp.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    let mounted = true;
    async function fetchNotifications() {
      if (!projectId || !token) return;
      try {
        const resp = await fetch(`/api/projects/${projectId}/notifications?token=${encodeURIComponent(token)}`);
        if (resp.ok && mounted) {
          const data = await resp.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch { /* ignore */ }
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, [projectId, token]);

  async function markAllRead() {
    if (!projectId || !token) return;
    try {
      await fetch(`/api/projects/${projectId}/notifications?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-lg bg-card/40 border border-white/8 flex items-center justify-center hover:border-primary/30 transition-colors backdrop-blur-md"
      >
        <Bell className="w-4 h-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto nexus-scroll bg-[#0c1322]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-primary/10 z-50 nexus-boot">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Thông báo</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-primary hover:text-primary/80 transition-colors">
                  Đánh dấu đã đọc
                </button>
              )}
            </div>

            {/* Notifications */}
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Chưa có thông báo</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {notifications.map((n) => {
                  const Icon = TYPE_ICONS[n.type] || Bell;
                  return (
                    <div
                      key={n.id}
                      className={`px-4 py-3 flex items-start gap-2.5 hover:bg-card/40 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${!n.read ? "bg-primary/15" : "bg-card/40"}`}>
                        <Icon className={`w-3.5 h-3.5 ${!n.read ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{n.title}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                        <p className="text-[9px] text-muted-foreground/50 mt-1">{fmtTime(n.createdAt)}</p>
                      </div>
                      {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
