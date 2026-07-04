"use client";

import { useEffect, useRef, useState } from "react";
import { io as ioFn, type Socket } from "socket.io-client";
import { useNexus } from "@/store/useNexus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useReloadProject } from "../useReload";
import { TaskProcessingOverlay } from "../TaskProcessingOverlay";
import {
  Send,
  Bot,
  RefreshCw,
  Loader2,
  Crown,
  User as UserIcon,
  Cpu,
  Lightbulb,
  Terminal,
  CheckCircle2,
} from "lucide-react";
import type { ChatMessageView } from "@/store/useNexus";

export function ChatTab() {
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);
  const access = useNexus((s) => s.access);
  const messages = useNexus((s) => s.messages);
  const addMessage = useNexus((s) => s.addMessage);
  const setMessages = useNexus((s) => s.setMessages);
  const reload = useReloadProject();
  const isLeader = access?.role === "leader";

  // Refine overlay state (live log console)
  const refineLogs = useNexus((s) => s.refineLogs);
  const refineError = useNexus((s) => s.refineError);
  const setRefineLogs = useNexus((s) => s.setRefineLogs);
  const setRefineError = useNexus((s) => s.setRefineError);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [refining, setRefining] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Socket.io connection
  useEffect(() => {
    if (!projectId || !access) return;
    // In production (Fly.io), connect to chat service domain directly.
    // In dev (sandbox), use XTransformPort=3001 for Caddy gateway.
    const chatServiceUrl = process.env.NEXT_PUBLIC_CHAT_URL;
    const socket = chatServiceUrl
      ? ioFn(chatServiceUrl, { transports: ["websocket", "polling"] })
      : ioFn("/?XTransformPort=3001", { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join", {
        projectId,
        name: access.name,
        role: access.role,
        token, // include token for chat service auth verification
      });
    });

    socket.on("message", (msg: { name: string; role: string; message: string; timestamp: string }) => {
      // Deduplicate: skip if this message was already added (optimistic or from DB)
      const exists = messages.some(
        (m) =>
          m.authorName === msg.name &&
          m.message === msg.message &&
          Math.abs(new Date(m.createdAt).getTime() - new Date(msg.timestamp).getTime()) < 2000
      );
      if (!exists) {
        addMessage({
          id: `sock-${Date.now()}-${Math.random()}`,
          authorName: msg.name,
          authorRole: msg.role,
          message: msg.message,
          createdAt: msg.timestamp,
        });
      }
    });

    socket.on("user_joined", (u: { name: string }) => {
      setOnlineUsers((prev) => (prev.includes(u.name) ? prev : [...prev, u.name]));
    });

    socket.on("user_left", (u: { name: string }) => {
      setOnlineUsers((prev) => prev.filter((n) => n !== u.name));
      setTypingUsers((prev) => prev.filter((n) => n !== u.name));
    });

    socket.on("typing", (data: { name: string }) => {
      setTypingUsers((prev) => (prev.includes(data.name) ? prev : [...prev, data.name]));
      // Clear typing after 3s
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((n) => n !== data.name));
      }, 3000);
    });

    socket.on("disconnect", () => {
      setOnlineUsers([]);
      setTypingUsers([]);
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId, access?.name, access?.role, token]);

  // Polling fallback: fetch new messages every 3s (works without Socket.io)
  // This enables running the app with ONLY the Next.js server (no chat service needed)
  useEffect(() => {
    if (!projectId || !token) return;
    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const resp = await fetch(`/api/projects/${projectId}/chat?token=${encodeURIComponent(token)}`);
        if (!resp.ok || !active) return;
        const data = (await resp.json()) as { messages?: ChatMessageView[] };
        if (data.messages && active) {
          // Replace all messages from server (source of truth)
          setMessages(data.messages);
        }
      } catch {
        /* network error — retry next cycle */
      }
    };

    const interval = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [projectId, token, setMessages]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || !access) return;
    setSending(true);
    setDraft("");
    // Optimistic: add to store immediately so the sender sees their message
    // even if the socket connection isn't established (e.g. direct port access).
    const optimisticMsg: ChatMessageView = {
      id: `local-${Date.now()}`,
      authorName: access.name,
      authorRole: access.role,
      message: text,
      createdAt: new Date().toISOString(),
    };
    addMessage(optimisticMsg);
    // persist
    try {
      const resp = await fetch(`/api/projects/${projectId}/chat?token=${encodeURIComponent(token || "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!resp.ok) throw new Error("Loi gui tin nhan");
    } catch {
      toast.error("Khong luu duoc tin nhan");
    }
    // emit via socket (other clients receive this; sender already has it locally)
    socketRef.current?.emit("send_message", {
      projectId,
      name: access.name,
      role: access.role,
      message: text,
    });
    setSending(false);
  }

  async function askAI() {
    if (!access) return;
    setAiThinking(true);
    try {
      const recent = messages
        .slice(-10)
        .map((m) => `${m.authorName}: ${m.message}`)
        .join("\n");
      const resp = await fetch(`/api/projects/${projectId}/chat/ai?token=${encodeURIComponent(token || "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recentMessages: recent }),
      });
      if (!resp.ok) throw new Error("Loi AI");
      const data = await resp.json();
      addMessage(data.message as ChatMessageView);
      socketRef.current?.emit("send_message", {
        projectId,
        name: "NEXUS AI",
        role: "ai",
        message: data.message.message,
      });
    } catch {
      toast.error("AI khong phan hoi duoc");
    } finally {
      setAiThinking(false);
    }
  }

  async function refineWithAI() {
    setRefining(true);
    setRefineLogs([]);
    setRefineError(null);

    try {
      const discussion = messages
        .slice(-30)
        .map((m) => `${m.authorName} (${m.authorRole}): ${m.message}`)
        .join("\n");

      const resp = await fetch(`/api/projects/${projectId}/refine?token=${encodeURIComponent(token || "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editRequests: [], chatDiscussion: discussion }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${resp.status}`);
      }

      // Poll until refine completes; sync logs each tick
      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const poll = async () => {
          attempts++;
          try {
            const pr = await fetch(`/api/projects/${projectId}/refine/progress`);
            if (!pr.ok) {
              if (pr.status === 404) {
                if (attempts > 3) {
                  resolve();
                  return;
                }
                setTimeout(poll, 2500);
                return;
              }
              throw new Error(`HTTP ${pr.status}`);
            }
            const prog = (await pr.json()) as {
              status: string;
              error?: string;
              logs?: { id: string; ts: number; level: "info" | "success" | "warn" | "error"; agentId?: string; provider?: "openrouter" | "cache" | "fallback" | "pipeline"; model?: string; keyIndex?: number; message: string }[];
              sections?: Record<string, boolean>;
            };
            // Sync live logs
            if (prog.logs) {
              setRefineLogs(prog.logs);
            }
            if (prog.status === "done") {
              resolve();
            } else if (prog.status === "error") {
              reject(new Error(prog.error || "Refine that bai"));
            } else {
              setTimeout(poll, 2500);
            }
          } catch (err) {
            if (attempts < 10) {
              setTimeout(poll, 3000);
            } else {
              reject(err instanceof Error ? err : new Error("Loi poll"));
            }
          }
        };
        setTimeout(poll, 1500);
      });

      await reload();
      toast.success(
        "✅ AI Refine thành công!\n🔄 Đã sinh lại tất cả 9 sections\n📋 Analysis, HR, Sprint, Design, UML, Docs, Git, Test, Security\n💡 Xem tab tương ứng để kiểm tra thay đổi",
        { duration: 8000 }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi AI refine";
      setRefineError(msg);
      toast.error(
        `❌ AI Refine thất bại!\n📋 Lý do: ${msg}\n🔧 Kiểm tra Live Log Console để xem chi tiết`,
        { duration: 10000 }
      );
    } finally {
      setRefining(false);
    }
  }

  function authorStyle(role: string) {
    if (role === "leader") return "text-amber-400";
    if (role === "ai") return "text-primary";
    return "text-sky-400";
  }
  function authorIcon(role: string) {
    if (role === "leader") return Crown;
    if (role === "ai") return Bot;
    return UserIcon;
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" /> Phong thao luan
            </span>
            <div className="flex items-center gap-2">
              {onlineUsers.length > 0 && (
                <Badge variant="outline" className="text-xs gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {onlineUsers.length} online
                </Badge>
              )}
              <Button variant="secondary" size="sm" onClick={askAI} disabled={aiThinking}>
                {aiThinking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Bot className="w-3.5 h-3.5" />
                )}
                Hoi AI
              </Button>
              {isLeader && (
                <Button
                  onClick={refineWithAI}
                  disabled={refining}
                  size="sm"
                  className="bg-primary text-primary-foreground"
                >
                  {refining ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  AI Refine
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* AI refine helper */}
      {isLeader && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-primary/[0.06] border border-primary/20 rounded-lg p-3">
          <Lightbulb className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-primary">AI Refine:</strong> Nhan de AI doc cuoc thao luan cua nhom
            va chinh sua lai TAT CA cac phan cho phu hop voi y kien cua moi nguoi.
          </div>
        </div>
      )}

      {/* Refine progress console (inline mini view) */}
      {refining && refineLogs.length > 0 && (
        <Card className="bg-nexus-bg border-border">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-mono text-muted-foreground">AI Refine Console</span>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground/70">
              {refineLogs.length} line(s)
            </span>
          </div>
          <div className="p-4 space-y-1.5 max-h-48 overflow-y-auto nexus-scroll font-mono text-[11px]">
            {refineLogs.slice(-15).map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                {log.level === "success" && <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />}
                {log.level === "error" && <span className="text-destructive">{"\u2716"}</span>}
                {log.level === "warn" && <span className="text-amber-400">{"\u26A0"}</span>}
                {log.level === "info" && <span className="text-muted-foreground">{"\u2022"}</span>}
                <span className="text-muted-foreground/80 text-[10px]">
                  {new Date(log.ts).toLocaleTimeString("en-GB", { hour12: false })}
                </span>
                {log.model && (
                  <span className="px-1 rounded bg-orange-500/15 text-orange-300 border border-orange-500/30 text-[9px] font-bold">
                    {log.model.length > 24 ? log.model.substring(0, 22) + "…" : log.model}
                  </span>
                )}
                <span className={
                  log.level === "error" ? "text-destructive" :
                  log.level === "success" ? "text-emerald-400" :
                  log.level === "warn" ? "text-amber-400" :
                  "text-foreground/80"
                }>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Full-screen overlay during refine — same UX as init */}
      {refining && (
        <TaskProcessingOverlay
          mode="refine"
          logs={refineLogs}
          error={refineError}
          progressMessage="AI đang đọc chat + edit requests để re-generate tất cả sections"
        />
      )}

      {/* Messages */}
      <Card className="bg-card border-border flex flex-col" style={{ height: "calc(100vh - 380px)", minHeight: "320px" }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto nexus-scroll p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              Chua co tin nhan. Bat dau thao luan ve du an cua ban!
            </div>
          )}
          {messages.map((m) => {
            const Icon = authorIcon(m.authorRole);
            return (
              <div
                key={m.id}
                className={`flex gap-2.5 ${
                  m.authorRole === "ai" ? "bg-primary/[0.05] -mx-2 px-2 py-2 rounded-lg" : ""
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    m.authorRole === "ai"
                      ? "bg-primary/20"
                      : m.authorRole === "leader"
                      ? "bg-amber-400/15"
                      : "bg-sky-400/15"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${authorStyle(m.authorRole)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-sm font-semibold ${authorStyle(m.authorRole)}`}>
                      {m.authorName}
                    </span>
                    {m.authorRole === "leader" && (
                      <Badge className="bg-amber-400/15 text-amber-400 text-[9px] px-1.5 py-0">
                        Leader
                      </Badge>
                    )}
                    {m.authorRole === "ai" && (
                      <Badge className="bg-primary/15 text-primary text-[9px] px-1.5 py-0">
                        AI
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground/60">
                      {new Date(m.createdAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap break-words">
                    {m.message}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-1.5 text-xs text-muted-foreground italic">
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "dang" : "dang"} go...
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border p-3 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              // Emit typing indicator (throttled by socket)
              if (access) {
                socketRef.current?.emit("typing", { projectId, name: access.name });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Nhap tin nhan... (Enter de gui)"
            className="bg-nexus-bg border-border"
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || !draft.trim()} className="bg-primary text-primary-foreground">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}
