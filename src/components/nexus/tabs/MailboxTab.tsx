"use client";

import { notify } from "@/lib/notify";
import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useNexus } from "@/store/useNexus";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Inbox,
  Send,
  FileEdit,
  Star,
  Archive,
  Trash2,
  ShieldAlert,
  Search,
  Loader2,
  PenSquare,
  Reply,
  ReplyAll,
  Forward,
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  List as ListIcon,
  Smile,
  Sparkles,
  Paperclip,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCheck,
  MailOpen,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MailItem {
  id: string;
  mailboxId: string;
  fromEmail: string;
  fromName: string;
  toEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
  subject: string;
  bodyPreview: string;
  bodyHtml: string;
  bodyText: string;
  type: string;
  smtpStatus: string;
  sentAt: string | null;
  createdAt: string;
  parentEmailId: string | null;
  folder: string;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  readAt: string | null;
  attachments: { id: string; filename: string; size: number; mimeType: string }[];
}

interface MailDetail extends MailItem {
  projectTopic: string;
  smtpError: string | null;
  smtpMessageId: string | null;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

const FOLDERS = [
  { id: "INBOX", label: "Inbox", icon: Inbox },
  { id: "SENT", label: "Sent", icon: Send },
  { id: "DRAFT", label: "Draft", icon: FileEdit },
  { id: "STARRED", label: "Starred", icon: Star },
  { id: "ARCHIVE", label: "Archive", icon: Archive },
  { id: "SPAM", label: "Spam", icon: ShieldAlert },
  { id: "TRASH", label: "Trash", icon: Trash2 },
];

const COMMON_EMOJIS = ["😀", "😂", "😍", "👍", "🎉", "🔥", "✅", "❌", "⚠️", "📌", "🎯", "💡", "🚀", "💪", "🙏", "👋", "📧", "⏰", "✨", "🤝"];

const AI_MODES = [
  { id: "improve", label: "Cải thiện" },
  { id: "professional", label: "Chuyên nghiệp" },
  { id: "friendly", label: "Thân thiện" },
  { id: "concise", label: "Ngắn gọn" },
  { id: "expand", label: "Mở rộng" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "2-digit" });
}
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MailboxTab() {
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const access = useNexus((s) => s.access);

  const [folder, setFolder] = useState("INBOX");
  const [mails, setMails] = useState<MailItem[]>([]);
  const [selected, setSelected] = useState<MailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(15);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [unreadInbox, setUnreadInbox] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<"new" | "reply" | "replyAll" | "forward">("new");
  const [composeParent, setComposeParent] = useState<MailDetail | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const isLeader = access?.role === "leader";

  const loadMails = useCallback(async () => {
    if (!projectId || !token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        token,
        folder,
        page: String(page),
        limit: String(limit),
      });
      if (search.trim()) params.set("q", search.trim());
      const resp = await fetch(`/api/projects/${projectId}/mailbox?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        setMails(data.mails || []);
        setTotal(data.total || 0);
        setFolderCounts(data.folderCounts || {});
        setUnreadInbox(data.unreadInbox || 0);
      }
    } catch {
      notify.error("Không tải được mailbox");
    } finally {
      setLoading(false);
    }
  }, [projectId, token, folder, page, limit, search]);

  // Load members (for compose recipient picker)
  useEffect(() => {
    if (!projectId || !token || !isLeader) return;
    (async () => {
      try {
        const resp = await fetch(`/api/projects/${projectId}/members?token=${token}`);
        if (resp.ok) {
          const data = await resp.json();
          setMembers(data.members || []);
        }
      } catch { /* ignore */ }
    })();
  }, [projectId, token, isLeader]);

  useEffect(() => {
    loadMails();
  }, [loadMails]);

  // Reset page when folder/search changes
  useEffect(() => {
    setPage(1);
  }, [folder, search]);

  // Realtime: listen for new mail
  useEffect(() => {
    if (!projectId || !token) return;
    const socket = io("/?XTransformPort=3002", { transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("join", { projectId, userEmail: access?.email || "", token });
    });
    socket.on("mail:new", () => {
      loadMails();
    });
    socket.on("mail_read", () => {
      loadMails();
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId, token, access?.email, loadMails]);

  async function openMail(mail: MailItem) {
    if (!projectId || !token) return;
    try {
      const resp = await fetch(
        `/api/projects/${projectId}/mailbox/${mail.id}?token=${token}&autoRead=1`
      );
      if (resp.ok) {
        const data = await resp.json();
        setSelected(data.mail);
        // Refresh list to update read state
        loadMails();
      }
    } catch {
      notify.error("Không mở được mail");
    }
  }

  async function patchMail(mailId: string, patch: Record<string, unknown>) {
    if (!projectId || !token) return;
    try {
      await fetch(`/api/projects/${projectId}/mailbox/${mailId}?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      loadMails();
      if (selected?.id === mailId) {
        setSelected((prev) => prev ? { ...prev, ...patch } as MailDetail : prev);
      }
    } catch {
      notify.error("Thao tác thất bại");
    }
  }

  async function deleteMail(mailId: string, permanent = false) {
    if (!projectId || !token) return;
    if (permanent && !confirm("Xóa vĩnh viễn email này?")) return;
    try {
      await fetch(`/api/projects/${projectId}/mailbox/${mailId}?token=${token}`, {
        method: "DELETE",
      });
      if (selected?.id === mailId) setSelected(null);
      notify.success("Đã xóa");
      loadMails();
    } catch {
      notify.error("Xóa thất bại");
    }
  }

  function startCompose(mode: "new" | "reply" | "replyAll" | "forward", parent: MailDetail | null = null) {
    setComposeMode(mode);
    setComposeParent(parent);
    setComposeOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold">
            <Inbox className="w-4 h-4 text-primary" /> Mailbox
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isLeader
              ? "Soạn và gửi mail thật cho thành viên. SMTP qua Gmail của bạn."
              : `Hộp thư của bạn (${access?.email || access?.name}).`}
          </p>
        </div>
        {isLeader && (
          <Button onClick={() => startCompose("new")} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <PenSquare className="w-4 h-4" /> Soạn mail
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
        {/* Folder sidebar */}
        <div className="space-y-1">
          {FOLDERS.map((f) => {
            const Icon = f.icon;
            const count = folderCounts[f.id] || 0;
            const isActive = folder === f.id;
            const showUnread = f.id === "INBOX" && unreadInbox > 0;
            return (
              <button
                key={f.id}
                onClick={() => setFolder(f.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-card/40 hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1 text-left">{f.label}</span>
                {showUnread ? (
                  <span className="text-[10px] bg-primary text-primary-foreground px-1.5 rounded-full font-bold">{unreadInbox}</span>
                ) : count > 0 ? (
                  <span className="text-[10px] text-muted-foreground/60">{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Mail list + detail */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* List */}
          <div className="space-y-2">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/40 border border-border/50 mb-2">
              <Search className="w-3.5 h-3.5 text-muted-foreground/60" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm mail..."
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : mails.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <Mail className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Không có mail nào.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto nexus-scroll pr-1">
                  {mails.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => openMail(m)}
                      className={`w-full text-left rounded-lg border p-3 transition-all ${
                        selected?.id === m.id
                          ? "border-primary bg-primary/5"
                          : "border-border/40 bg-card/30 hover:border-primary/30 hover:bg-card/50"
                      } ${!m.isRead ? "border-l-2 border-l-primary" : ""}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {!m.isRead && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                        {m.isStarred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
                        <span className={`text-xs font-medium truncate flex-1 ${!m.isRead ? "font-bold" : ""}`}>
                          {folder === "SENT" || m.folder === "SENT" ? `To: ${m.toEmails[0] || ""}` : m.fromName || m.fromEmail}
                        </span>
                        <span className="text-[9px] text-muted-foreground/60 flex-shrink-0">
                          {m.sentAt ? new Date(m.sentAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) : ""}
                        </span>
                      </div>
                      <p className="text-xs truncate mb-0.5">{m.subject || "(no subject)"}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{m.bodyPreview}</p>
                      {m.attachments.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground/70">
                          <Paperclip className="w-2.5 h-2.5" /> {m.attachments.length} file
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Pagination */}
                {total > limit && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] text-muted-foreground">
                      {(page - 1) * limit + 1}-{Math.min(page * limit, total)} / {total}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="w-7 h-7 rounded-md bg-card/40 border border-border/40 flex items-center justify-center disabled:opacity-30 hover:bg-card/60"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(Math.ceil(total / limit), p + 1))}
                        disabled={page * limit >= total}
                        className="w-7 h-7 rounded-md bg-card/40 border border-border/40 flex items-center justify-center disabled:opacity-30 hover:bg-card/60"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Detail */}
          <div className="lg:sticky lg:top-4 h-fit">
            {selected ? (
              <Card className="bg-card border-border">
                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h4 className="font-semibold text-sm flex-1">{selected.subject || "(no subject)"}</h4>
                    <button
                      onClick={() => setSelected(null)}
                      className="lg:hidden text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>

                  {/* From / To / metadata */}
                  <div className="text-xs space-y-1 mb-3 pb-3 border-b border-border">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                        {selected.fromName?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{selected.fromName} <span className="text-muted-foreground">&lt;{selected.fromEmail}&gt;</span></p>
                        <p className="text-[10px] text-muted-foreground">
                          đến {selected.toEmails.join(", ")}
                        </p>
                        {selected.ccEmails.length > 0 && (
                          <p className="text-[10px] text-muted-foreground">cc {selected.ccEmails.join(", ")}</p>
                        )}
                        {selected.bccEmails.length > 0 && (
                          <p className="text-[10px] text-muted-foreground">bcc {selected.bccEmails.length} người</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {selected.sentAt ? fmtDate(selected.sentAt) : fmtDate(selected.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {selected.smtpStatus === "sent" && (
                          <Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border-0">Đã gửi SMTP</Badge>
                        )}
                        {selected.smtpStatus === "failed" && (
                          <Badge className="text-[9px] bg-red-500/15 text-red-400 border-0" title={selected.smtpError || ""}>SMTP lỗi</Badge>
                        )}
                        {selected.smtpStatus === "logged_only" && (
                          <Badge className="text-[9px] bg-amber-500/15 text-amber-400 border-0">Chỉ lưu Mailbox</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div
                    className="text-xs text-foreground/90 leading-relaxed prose prose-invert prose-sm max-w-none mb-3 max-h-[300px] overflow-y-auto nexus-scroll"
                    dangerouslySetInnerHTML={{ __html: selected.bodyHtml || `<pre>${selected.bodyText}</pre>` }}
                  />

                  {/* Attachments */}
                  {selected.attachments.length > 0 && (
                    <div className="mb-3 pt-3 border-t border-border">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2">File đính kèm</p>
                      <div className="space-y-1">
                        {selected.attachments.map((a) => (
                          <a
                            key={a.id}
                            href={`/api/projects/${projectId}/mailbox/attachments/${a.id}?token=${token}`}
                            className="flex items-center gap-2 p-2 rounded-lg bg-card/40 border border-border/40 hover:border-primary/30 transition-colors"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            <span className="text-xs flex-1 truncate">{a.filename}</span>
                            <span className="text-[10px] text-muted-foreground">{fmtSize(a.size)}</span>
                            <Download className="w-3.5 h-3.5 text-muted-foreground" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-border">
                    {isLeader && (
                      <>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => startCompose("reply", selected)}>
                          <Reply className="w-3.5 h-3.5" /> Reply
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => startCompose("replyAll", selected)}>
                          <ReplyAll className="w-3.5 h-3.5" /> Reply All
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => startCompose("forward", selected)}>
                          <Forward className="w-3.5 h-3.5" /> Forward
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => patchMail(selected.id, { isStarred: !selected.isStarred })}
                    >
                      <Star className={`w-3.5 h-3.5 ${selected.isStarred ? "text-amber-400 fill-amber-400" : ""}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => patchMail(selected.id, { isArchived: !selected.isArchived })}
                      title="Archive"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => patchMail(selected.id, { isRead: !selected.isRead })}
                      title={selected.isRead ? "Mark unread" : "Mark read"}
                    >
                      {selected.isRead ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-destructive hover:text-destructive ml-auto"
                      onClick={() => deleteMail(selected.id, selected.isTrashed)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {selected.isTrashed ? "Xóa vĩnh viễn" : "Xóa"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="p-10 text-center">
                  <Mail className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Chọn một email để xem nội dung</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Compose Dialog */}
      {composeOpen && (
        <ComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          mode={composeMode}
          parent={composeParent}
          members={members}
          leaderEmail={access?.email || ""}
          leaderName={access?.name || ""}
          projectTopic={useNexus.getState().project?.topic || ""}
          onSent={() => {
            setComposeOpen(false);
            loadMails();
          }}
        />
      )}
    </div>
  );
}

// ===== Compose Dialog =====
interface ComposeProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "new" | "reply" | "replyAll" | "forward";
  parent: MailDetail | null;
  members: Member[];
  leaderEmail: string;
  leaderName: string;
  projectTopic: string;
  onSent: () => void;
}

function ComposeDialog({
  open,
  onOpenChange,
  mode,
  parent,
  members,
  leaderEmail,
  leaderName,
  projectTopic,
  onSent,
}: ComposeProps) {
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);

  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiRewriting, setAiRewriting] = useState(false);
  const [aiMode, setAiMode] = useState("improve");
  const bodyRef = useRef<HTMLDivElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Initialize fields based on mode
  useEffect(() => {
    if (!open) return;
    if (mode === "reply" && parent) {
      setToEmails([parent.fromEmail]);
      setCcEmails([]);
      setBccEmails([]);
      setSubject(parent.subject.startsWith("Re:") ? parent.subject : `Re: ${parent.subject}`);
      setShowCcBcc(false);
      setTimeout(() => {
        if (bodyRef.current) {
          bodyRef.current.innerHTML = `<br><br><br><blockquote style="border-left:2px solid #1a2a40;padding-left:10px;margin-left:0;color:#94a3b8;">Vào ${fmtDate(parent.sentAt || parent.createdAt)}, ${parent.fromName} &lt;${parent.fromEmail}&gt; đã viết:<br>${parent.bodyHtml || `<pre>${parent.bodyText}</pre>`}</blockquote>`;
        }
      }, 100);
    } else if (mode === "replyAll" && parent) {
      setToEmails([parent.fromEmail, ...parent.toEmails.filter((e) => e !== leaderEmail)]);
      setCcEmails(parent.ccEmails.filter((e) => e !== leaderEmail));
      setBccEmails([]);
      setSubject(parent.subject.startsWith("Re:") ? parent.subject : `Re: ${parent.subject}`);
      setShowCcBcc(parent.ccEmails.length > 0);
      setTimeout(() => {
        if (bodyRef.current) {
          bodyRef.current.innerHTML = `<br><br><br><blockquote style="border-left:2px solid #1a2a40;padding-left:10px;margin-left:0;color:#94a3b8;">Vào ${fmtDate(parent.sentAt || parent.createdAt)}, ${parent.fromName} &lt;${parent.fromEmail}&gt; đã viết:<br>${parent.bodyHtml || `<pre>${parent.bodyText}</pre>`}</blockquote>`;
        }
      }, 100);
    } else if (mode === "forward" && parent) {
      setToEmails([]);
      setCcEmails([]);
      setBccEmails([]);
      setSubject(parent.subject.startsWith("Fwd:") ? parent.subject : `Fwd: ${parent.subject}`);
      setTimeout(() => {
        if (bodyRef.current) {
          bodyRef.current.innerHTML = `<br><br>---------- Forwarded message ----------<br>From: ${parent.fromName} &lt;${parent.fromEmail}&gt;<br>Date: ${fmtDate(parent.sentAt || parent.createdAt)}<br>Subject: ${parent.subject}<br><br>${parent.bodyHtml || `<pre>${parent.bodyText}</pre>`}`;
        }
      }, 100);
    } else {
      setToEmails([]);
      setCcEmails([]);
      setBccEmails([]);
      setSubject("");
      setShowCcBcc(false);
      setTimeout(() => {
        if (bodyRef.current) bodyRef.current.innerHTML = "";
      }, 100);
    }
  }, [open, mode, parent, leaderEmail]);

  function toggleRecipient(list: string[], setList: (v: string[]) => void, email: string) {
    if (list.includes(email)) setList(list.filter((e) => e !== email));
    else setList([...list, email]);
  }

  function execCmd(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    bodyRef.current?.focus();
  }

  function insertEmoji(emoji: string) {
    bodyRef.current?.focus();
    document.execCommand("insertText", false, emoji);
    setEmojiOpen(false);
  }

  async function handleSend(asDraft = false) {
    if (!projectId || !token) return;
    if (!asDraft && toEmails.length === 0) {
      notify.error("Chọn ít nhất 1 người nhận");
      return;
    }
    if (!subject.trim()) {
      notify.error("Nhập chủ đề");
      return;
    }
    const bodyHtml = bodyRef.current?.innerHTML || "";
    const bodyText = bodyRef.current?.innerText || "";
    if (!bodyHtml.trim() && !asDraft) {
      notify.error("Nhập nội dung mail");
      return;
    }

    setSending(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}/mailbox?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmails,
          ccEmails,
          bccEmails,
          subject,
          bodyHtml,
          bodyText,
          asDraft,
          parentEmailId: parent?.id,
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        notify.success(asDraft ? "Đã lưu nháp" : `Mail đã gửi! SMTP: ${data.smtpStatus}`);
        onSent();
      } else {
        notify.error(data.error || "Gửi thất bại");
      }
    } catch {
      notify.error("Lỗi kết nối");
    } finally {
      setSending(false);
    }
  }

  async function handleAiRewrite() {
    if (!projectId || !token) return;
    const bodyHtml = bodyRef.current?.innerHTML || "";
    if (!bodyHtml.trim()) {
      notify.error("Viết nội dung trước khi dùng AI");
      return;
    }
    setAiRewriting(true);
    try {
      const resp = await fetch(`/api/projects/${projectId}/mailbox/ai-rewrite?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body: bodyHtml,
          toEmails,
          mode: aiMode,
          projectTopic,
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.rewritten) {
        if (bodyRef.current) bodyRef.current.innerHTML = data.rewritten;
        notify.success(`AI đã viết lại (chế độ: ${AI_MODES.find((m) => m.id === aiMode)?.label})`);
      } else {
        notify.error(data.error || "AI rewrite thất bại");
      }
    } catch {
      notify.error("Lỗi kết nối AI");
    } finally {
      setAiRewriting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-nexus-surface-2 border-border/60 max-h-[90vh] overflow-y-auto nexus-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PenSquare className="w-4 h-4 text-primary" />
            {mode === "new" ? "Soạn mail mới" : mode === "reply" ? "Trả lời" : mode === "replyAll" ? "Trả lời tất cả" : "Chuyển tiếp"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Người nhận (To)</label>
              <button
                onClick={() => setShowCcBcc((v) => !v)}
                className="text-[10px] text-primary hover:text-primary/80"
              >
                {showCcBcc ? "Ẩn CC/BCC" : "Thêm CC/BCC"}
              </button>
            </div>
            <RecipientPicker
              selected={toEmails}
              onToggle={(e) => toggleRecipient(toEmails, setToEmails, e)}
              members={members}
              leaderEmail={leaderEmail}
              leaderName={leaderName}
            />
          </div>

          {showCcBcc && (
            <>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 block mb-1.5">CC</label>
                <RecipientPicker
                  selected={ccEmails}
                  onToggle={(e) => toggleRecipient(ccEmails, setCcEmails, e)}
                  members={members}
                  leaderEmail={leaderEmail}
                  leaderName={leaderName}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 block mb-1.5">BCC</label>
                <RecipientPicker
                  selected={bccEmails}
                  onToggle={(e) => toggleRecipient(bccEmails, setBccEmails, e)}
                  members={members}
                  leaderEmail={leaderEmail}
                  leaderName={leaderName}
                />
              </div>
            </>
          )}

          {/* Quick group buttons */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setToEmails(members.map((m) => m.email))}
              className="text-[10px] px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              Toàn bộ nhóm
            </button>
            {Array.from(new Set(members.map((m) => m.role).filter(Boolean))).map((role) => (
              <button
                key={role}
                onClick={() => setToEmails(members.filter((m) => m.role === role).map((m) => m.email))}
                className="text-[10px] px-2 py-1 rounded-md bg-card/40 border border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
              >
                Theo role: {role}
              </button>
            ))}
          </div>

          {/* Subject */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 block mb-1.5">Chủ đề</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Nhập chủ đề..."
              className="w-full px-3 py-2 rounded-lg bg-nexus-surface-2 border border-border text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Rich text toolbar */}
          <div className="flex items-center gap-1 p-1.5 rounded-lg bg-card/40 border border-border/40">
            <button onClick={() => execCmd("bold")} className="w-7 h-7 rounded hover:bg-primary/15 flex items-center justify-center" title="Bold"><Bold className="w-3.5 h-3.5" /></button>
            <button onClick={() => execCmd("italic")} className="w-7 h-7 rounded hover:bg-primary/15 flex items-center justify-center" title="Italic"><Italic className="w-3.5 h-3.5" /></button>
            <button onClick={() => execCmd("underline")} className="w-7 h-7 rounded hover:bg-primary/15 flex items-center justify-center" title="Underline"><Underline className="w-3.5 h-3.5" /></button>
            <button onClick={() => execCmd("insertUnorderedList")} className="w-7 h-7 rounded hover:bg-primary/15 flex items-center justify-center" title="Bullet list"><ListIcon className="w-3.5 h-3.5" /></button>
            <div className="relative">
              <button onClick={() => setEmojiOpen((v) => !v)} className="w-7 h-7 rounded hover:bg-primary/15 flex items-center justify-center" title="Emoji"><Smile className="w-3.5 h-3.5" /></button>
              {emojiOpen && (
                <div className="absolute top-8 left-0 z-50 w-64 p-2 rounded-lg bg-nexus-surface-2 border border-border/60 shadow-xl grid grid-cols-8 gap-1">
                  {COMMON_EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => insertEmoji(e)}
                      className="w-7 h-7 rounded hover:bg-primary/15 text-base flex items-center justify-center"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="h-5 w-px bg-border mx-1" />
            {/* AI rewrite */}
            <select
              value={aiMode}
              onChange={(e) => setAiMode(e.target.value)}
              className="text-[10px] px-1.5 py-1 rounded bg-transparent border border-border/40 outline-none text-muted-foreground"
            >
              {AI_MODES.map((m) => (
                <option key={m.id} value={m.id} className="bg-nexus-surface-2">{m.label}</option>
              ))}
            </select>
            <button
              onClick={handleAiRewrite}
              disabled={aiRewriting}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
              title="AI viết lại nội dung"
            >
              {aiRewriting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              AI viết lại
            </button>
          </div>

          {/* Body (contentEditable) */}
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[200px] max-h-[300px] overflow-y-auto nexus-scroll p-3 rounded-lg bg-nexus-surface-2 border border-border text-sm outline-none focus:border-primary prose prose-invert prose-sm max-w-none"
            data-placeholder="Viết nội dung mail..."
          />

          {/* SMTP status hint */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
            <AlertCircle className="w-3 h-3" />
            Email sẽ gửi qua SMTP của <strong className="text-foreground">{leaderEmail}</strong>. Nếu chưa cấu hình Gmail App Password, mail vẫn lưu vào Mailbox.
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={() => handleSend(false)}
              disabled={sending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Gửi mail
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleSend(true)}
              disabled={sending}
              className="text-muted-foreground"
            >
              <FileEdit className="w-4 h-4" /> Lưu nháp
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="ml-auto text-muted-foreground">
              Hủy
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== Recipient picker (multi-select chips) =====
function RecipientPicker({
  selected,
  onToggle,
  members,
  leaderEmail,
  leaderName,
}: {
  selected: string[];
  onToggle: (email: string) => void;
  members: Member[];
  leaderEmail: string;
  leaderName: string;
}) {
  const [input, setInput] = useState("");
  const allOptions = [
    { email: leaderEmail, name: leaderName, role: "Leader" },
    ...members.map((m) => ({ email: m.email, name: m.name, role: m.role })),
  ];
  const filtered = allOptions.filter(
    (o) =>
      !selected.includes(o.email) &&
      (o.email.toLowerCase().includes(input.toLowerCase()) ||
        o.name.toLowerCase().includes(input.toLowerCase()))
  );

  return (
    <div className="rounded-lg bg-nexus-surface-2 border border-border p-2 min-h-[42px]">
      <div className="flex flex-wrap gap-1 mb-1">
        {selected.map((email) => {
          const opt = allOptions.find((o) => o.email === email);
          return (
            <span
              key={email}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/15 text-primary text-[11px]"
            >
              {opt?.name || email}
              <button onClick={() => onToggle(email)} className="hover:text-primary/70">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          );
        })}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={selected.length === 0 ? "Gõ tên hoặc email..." : "Thêm..."}
        className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
      />
      {input && filtered.length > 0 && (
        <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto nexus-scroll">
          {filtered.slice(0, 8).map((o) => (
            <button
              key={o.email}
              onClick={() => {
                onToggle(o.email);
                setInput("");
              }}
              className="w-full text-left px-2 py-1 rounded hover:bg-card/40 text-xs flex items-center justify-between"
            >
              <span>{o.name} <span className="text-muted-foreground">&lt;{o.email}&gt;</span></span>
              {o.role && <span className="text-[9px] text-muted-foreground">{o.role}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
