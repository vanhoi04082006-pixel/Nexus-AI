"use client";

import { notify } from "@/lib/notify";
import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useNexus } from "@/store/useNexus";
import {
  Bell,
  CheckCircle2,
  Edit3,
  FileText,
  Rocket,
  RefreshCw,
  Mail,
  AlertTriangle,
  Clock,
  UserPlus,
  ShieldAlert,
  MessageSquare,
  Upload,
  Bot,
  X,
  Check,
  Trash2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  senderName: string;
  senderRole: string;
  recipientEmail: string | null;
  priority: string;
  relatedTaskId: string | null;
  relatedTaskTitle: string;
  relatedMailId: string | null;
  actionUrl: string;
  actionLabel: string;
  extra: string;
  createdAt: string;
  read: boolean;
  readAt: string | null;
  projectTopic: string;
  projectId: string;
}

const TYPE_META: Record<
  string,
  { icon: typeof Bell; color: string; bg: string; label: string }
> = {
  TASK_COMPLETED: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15", label: "Task hoàn thành" },
  TASK_STATUS_CHANGED: { icon: RefreshCw, color: "text-cyan-400", bg: "bg-cyan-500/15", label: "Đổi trạng thái Task" },
  PROPOSAL_CREATED: { icon: Edit3, color: "text-amber-400", bg: "bg-amber-500/15", label: "Proposal mới" },
  REQUIREMENT_EDITED: { icon: FileText, color: "text-blue-400", bg: "bg-blue-500/15", label: "Requirement chỉnh sửa" },
  DOC_UPLOADED: { icon: Upload, color: "text-purple-400", bg: "bg-purple-500/15", label: "Tài liệu mới" },
  COMMENT: { icon: MessageSquare, color: "text-cyan-400", bg: "bg-cyan-500/15", label: "Bình luận" },
  AI_DONE: { icon: Bot, color: "text-emerald-400", bg: "bg-emerald-500/15", label: "AI hoàn thành" },
  AI_ERROR: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/15", label: "AI lỗi" },
  DEADLINE_SOON: { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/15", label: "Deadline sắp đến" },
  TASK_ASSIGNED: { icon: FileText, color: "text-primary", bg: "bg-primary/15", label: "Được assign Task" },
  MAIL_RECEIVED: { icon: Mail, color: "text-cyan-400", bg: "bg-cyan-500/15", label: "Mail mới" },
  PROJECT_INVITE: { icon: UserPlus, color: "text-primary", bg: "bg-primary/15", label: "Lời mời dự án" },
  APPROVAL_REQUEST: { icon: ShieldAlert, color: "text-amber-400", bg: "bg-amber-500/15", label: "Yêu cầu phê duyệt" },
  ACTIVITY: { icon: Bell, color: "text-muted-foreground", bg: "bg-card/40", label: "Hoạt động" },
  PIPELINE_DONE: { icon: Rocket, color: "text-primary", bg: "bg-primary/15", label: "Pipeline hoàn thành" },
  INIT_DONE: { icon: Rocket, color: "text-primary", bg: "bg-primary/15", label: "Khởi tạo xong" },
  REFINE_DONE: { icon: RefreshCw, color: "text-primary", bg: "bg-primary/15", label: "Refine xong" },
  EDIT_PROPOSAL: { icon: Edit3, color: "text-amber-400", bg: "bg-amber-500/15", label: "Edit proposal" },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-slate-400",
  normal: "text-muted-foreground",
  high: "text-amber-400",
  urgent: "text-red-400",
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "vừa xong";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
  return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function NotificationBell() {
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const setView = useNexus((s) => s.setView);
  const setRoute = useNexus((s) => s.setRoute);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [detailNotif, setDetailNotif] = useState<NotificationItem | null>(null);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!projectId || !token) return;
    try {
      const resp = await fetch(
        `/api/projects/${projectId}/notifications?token=${encodeURIComponent(token)}`
      );
      if (resp.ok) {
        const data = await resp.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      /* ignore */
    }
  }, [projectId, token]);

  // Initial load + polling fallback (every 15s) in case WS misses an event
  useEffect(() => {
    let active = true;
    (async () => {
      if (projectId && token) {
        try {
          const resp = await fetch(
            `/api/projects/${projectId}/notifications?token=${encodeURIComponent(token)}`
          );
          if (resp.ok && active) {
            const data = await resp.json();
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
          }
        } catch { /* ignore */ }
      }
    })();
    const interval = setInterval(loadNotifications, 15000);
    return () => { active = false; clearInterval(interval); };
  }, [projectId, token]);

  // Realtime WebSocket
  useEffect(() => {
    if (!projectId || !token) return;
    const socket = io("/?XTransformPort=3002", { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      // Get user email from the last load (resolveAccess returns it)
      // We'll use a placeholder; the server broadcasts to the project room anyway
      const userEmail = notifications[0]?.recipientEmail || "";
      socket.emit("join", { projectId, userEmail, token });
    });

    socket.on("notification:new", () => {
      // Reload to get the new notification + updated unread count
      loadNotifications();
    });

    socket.on("notification_read", () => {
      loadNotifications();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId, token]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function markAsRead(notifId: string) {
    if (!projectId || !token) return;
    try {
      await fetch(
        `/api/projects/${projectId}/notifications/${notifId}?token=${encodeURIComponent(token)}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }) }
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      notify.error("Không thể đánh dấu đã đọc");
    }
  }

  async function markAllRead() {
    if (!projectId || !token) return;
    try {
      await fetch(`/api/projects/${projectId}/notifications?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
      notify.success("Đã đánh dấu tất cả là đã đọc");
    } catch {
      notify.error("Thất bại");
    }
  }

  async function deleteNotification(notifId: string) {
    if (!projectId || !token) return;
    try {
      await fetch(
        `/api/projects/${projectId}/notifications/${notifId}?token=${encodeURIComponent(token)}`,
        { method: "DELETE" }
      );
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      notify.success("Đã xóa thông báo");
    } catch {
      notify.error("Xóa thất bại");
    }
  }

  function openDetail(n: NotificationItem) {
    setDetailNotif(n);
    // Mark as read when opening detail (user explicitly clicked)
    if (!n.read) markAsRead(n.id);
  }

  function handleActionClick(n: NotificationItem) {
    // Navigate if actionUrl present
    if (n.actionUrl) {
      const url = new URL(n.actionUrl, window.location.origin);
      const pId = url.searchParams.get("p");
      const pToken = url.searchParams.get("token");
      if (pId && pToken) {
        setRoute(pId, pToken);
        setView("workspace");
        window.history.pushState({}, "", n.actionUrl);
      }
    }
    setDetailNotif(null);
    setOpen(false);
  }

  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-lg bg-card/40 border border-border/50 flex items-center justify-center hover:border-primary/30 transition-colors backdrop-blur-md"
        aria-label="Thông báo"
      >
        <Bell className="w-4 h-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[500px] flex flex-col bg-nexus-surface-2/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl shadow-primary/10 z-50 nexus-boot">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Thông báo</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold">{unreadCount} mới</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilter((f) => (f === "all" ? "unread" : "all"))}
                className="text-[10px] px-2 py-1 rounded-md hover:bg-card/40 text-muted-foreground hover:text-foreground transition-colors"
              >
                {filter === "all" ? "Chưa đọc" : "Tất cả"}
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] px-2 py-1 rounded-md hover:bg-primary/10 text-primary transition-colors flex items-center gap-1"
                  title="Đánh dấu tất cả đã đọc"
                >
                  <Check className="w-3 h-3" /> Đọc hết
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto nexus-scroll">
            {loading ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">Đang tải...</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">{filter === "unread" ? "Không có thông báo chưa đọc" : "Chưa có thông báo"}</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {filtered.map((n) => {
                  const meta = TYPE_META[n.type] || TYPE_META.ACTIVITY;
                  const Icon = meta.icon;
                  return (
                    <div
                      key={n.id}
                      className={`px-4 py-3 flex items-start gap-2.5 hover:bg-card/40 transition-colors cursor-pointer group ${!n.read ? "bg-primary/5" : ""}`}
                      onClick={() => openDetail(n)}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                          <p className="text-xs font-medium truncate">{n.title}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {n.senderName && <span className="text-[9px] text-muted-foreground/70">{n.senderName}</span>}
                          <span className="text-[9px] text-muted-foreground/50">{fmtTime(n.createdAt)}</span>
                          {n.priority === "urgent" && <span className="text-[9px] text-red-400 font-bold">URGENT</span>}
                        </div>
                      </div>
                      {/* Hover actions */}
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {!n.read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                            className="w-6 h-6 rounded-md hover:bg-primary/15 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                            title="Đánh dấu đã đọc"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          className="w-6 h-6 rounded-md hover:bg-destructive/15 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!detailNotif} onOpenChange={(o) => !o && setDetailNotif(null)}>
        <DialogContent className="max-w-lg bg-nexus-surface-2 border-border/60">
          {detailNotif && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  {(() => {
                    const meta = TYPE_META[detailNotif.type] || TYPE_META.ACTIVITY;
                    const Icon = meta.icon;
                    return (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                        <Icon className={`w-5 h-5 ${meta.color}`} />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-base">{detailNotif.title}</DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {TYPE_META[detailNotif.type]?.label || "Thông báo"}
                      {detailNotif.priority !== "normal" && (
                        <span className={`ml-2 font-bold ${PRIORITY_COLORS[detailNotif.priority]}`}>
                          {detailNotif.priority.toUpperCase()}
                        </span>
                      )}
                    </p>
                  </div>
                  {detailNotif.read ? (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 flex-shrink-0">
                      <Check className="w-3 h-3" /> Đã đọc
                    </span>
                  ) : (
                    <span className="text-[10px] text-primary flex-shrink-0">Chưa đọc</span>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-3 py-2">
                {/* Message */}
                <div className="rounded-lg bg-card/40 border border-border/40 p-3">
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{detailNotif.message}</p>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-card/30 border border-border/30 p-2.5">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1">Người thực hiện</p>
                    <p className="font-medium truncate">{detailNotif.senderName || "Hệ thống"}</p>
                    {detailNotif.senderRole && <p className="text-[10px] text-muted-foreground">{detailNotif.senderRole}</p>}
                  </div>
                  <div className="rounded-lg bg-card/30 border border-border/30 p-2.5">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1">Thời gian</p>
                    <p className="font-medium">{fmtTime(detailNotif.createdAt)}</p>
                  </div>
                  <div className="rounded-lg bg-card/30 border border-border/30 p-2.5">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1">Dự án</p>
                    <p className="font-medium truncate">{detailNotif.projectTopic || "—"}</p>
                  </div>
                  {detailNotif.relatedTaskTitle && (
                    <div className="rounded-lg bg-card/30 border border-border/30 p-2.5">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1">Task</p>
                      <p className="font-medium truncate">{detailNotif.relatedTaskTitle}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  {detailNotif.actionUrl && detailNotif.actionLabel && (
                    <button
                      onClick={() => handleActionClick(detailNotif)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> {detailNotif.actionLabel}
                    </button>
                  )}
                  {!detailNotif.read && (
                    <button
                      onClick={() => markAsRead(detailNotif.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card/60 border border-border text-xs hover:bg-card transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Đánh dấu đã đọc
                    </button>
                  )}
                  <button
                    onClick={() => { deleteNotification(detailNotif.id); setDetailNotif(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs hover:bg-destructive/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
