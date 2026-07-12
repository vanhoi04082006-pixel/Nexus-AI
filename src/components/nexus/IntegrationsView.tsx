"use client";

import { notify } from "@/lib/notify";
import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useNexus } from "@/store/useNexus";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Cpu,
  Brain,
  Github,
  Mail,
  Globe,
  Server,
  Database,
  Boxes,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Copy,
  Settings,
  Shield,
  Plug,
  Zap,
  Terminal,
  ArrowUpRight,
  KeyRound,
  Network,
  Activity,
} from "lucide-react";
import { AppSidebar } from "./AppSidebar";

/* ===========================================================
   Types
=========================================================== */
interface ApiKeysInfo {
  total: number;
  active: number;
  expired: number;
  nearQuota: number;
  provider: string;
}

interface GitHubStatus {
  connected: boolean;
  username: string | null;
  repoName: string | null;
  pushedAt: string | null;
}

interface ConfigData {
  publicUrl: string;
  isLocal: boolean;
}

type StatusKind = "connected" | "disconnected" | "partial" | "unknown";

/* ===========================================================
   Constants
=========================================================== */
const FREE_MODELS = [
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3-coder:free",
  "deepseek/deepseek-r1:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "microsoft/phi-3-medium-128k-instruct:free",
  "google/gemini-2.0-flash-exp:free",
];

const MINI_SERVICES = [
  {
    name: "Chat Service",
    port: 3001,
    desc: "Socket.io realtime chat",
    events: ["chat:message", "chat:typing"],
    icon: Server,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    name: "Notification Service",
    port: 3002,
    desc: "Socket.io realtime notifications",
    events: ["notification", "subscribe"],
    icon: Activity,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
];

const SMTP_DOMAINS: Record<string, { host: string; port: number }> = {
  "gmail.com": { host: "smtp.gmail.com", port: 587 },
  "outlook.com": { host: "smtp.office365.com", port: 587 },
  "hotmail.com": { host: "smtp.office365.com", port: 587 },
  "yahoo.com": { host: "smtp.mail.yahoo.com", port: 587 },
  "icloud.com": { host: "smtp.mail.me.com", port: 587 },
  "zoho.com": { host: "smtp.zoho.com", port: 587 },
};

/* ===========================================================
   Helpers
=========================================================== */
function detectSmtp(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (SMTP_DOMAINS[domain]) return { domain, ...SMTP_DOMAINS[domain] };
  return { domain: domain || "unknown", host: "smtp.gmail.com", port: 587 };
}

function detectTunnel(publicUrl: string): { mode: string; provider: string } {
  if (!publicUrl || publicUrl.includes("localhost") || publicUrl.includes("127.0.0.1")) {
    return { mode: "local-only", provider: "none" };
  }
  if (publicUrl.includes("ngrok")) return { mode: "ngrok", provider: "ngrok" };
  if (publicUrl.includes("trycloudflare.com")) return { mode: "cloudflare-named", provider: "cloudflare" };
  if (publicUrl.includes("loca.lt")) return { mode: "quick", provider: "localtunnel" };
  return { mode: "custom", provider: "reverse-proxy" };
}

function maskEmail(email: string): string {
  if (!email) return "";
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const maskedUser =
    user.length <= 2
      ? user
      : user[0] + "*".repeat(Math.max(1, user.length - 2)) + user[user.length - 1];
  return `${maskedUser}@${domain}`;
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(date)
    );
  } catch {
    return date;
  }
}

/* ===========================================================
   Sub-components
=========================================================== */
function StatusBadge({ status }: { status: StatusKind }) {
  const map: Record<
    StatusKind,
    { label: string; cls: string; Icon: typeof CheckCircle2 }
  > = {
    connected: {
      label: "Đã kết nối",
      cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      Icon: CheckCircle2,
    },
    disconnected: {
      label: "Chưa kết nối",
      cls: "bg-red-500/15 text-red-400 border-red-500/30",
      Icon: XCircle,
    },
    partial: {
      label: "Cấu hình một phần",
      cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      Icon: AlertCircle,
    },
    unknown: {
      label: "Không xác định",
      cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
      Icon: AlertCircle,
    },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${cls}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function IntegrationCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  badge,
  children,
}: {
  icon: typeof Cpu;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/50 backdrop-blur-xl p-5 nexus-hud shadow-lg shadow-primary/5 hover:border-primary/30 transition-colors flex flex-col">
      <div className="flex items-start gap-3 mb-4">
        <div
          className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-sm">{title}</h3>
            {badge}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-muted-foreground/70 flex-shrink-0">{label}</span>
      <span
        className={`text-right text-foreground/90 ${
          mono ? "font-mono text-[11px]" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Note({ icon: Icon, children }: { icon: typeof Shield; children: ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground/80">
      <Icon className="w-3 h-3 mt-0.5 flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/* ===========================================================
   Main component
=========================================================== */
export function IntegrationsView() {
  const setView = useNexus((s) => s.setView);
  const project = useNexus((s) => s.project);
  const projectId = useNexus((s) => s.projectId);
  const token = useNexus((s) => s.token);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeysInfo | null>(null);
  const [github, setGithub] = useState<GitHubStatus | null>(null);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [emailSentCount, setEmailSentCount] = useState<number | null>(null);

  const hasProject = !!(project && projectId && token);

  const loadAll = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        // 1. Config (always available)
        const configPromise = fetch("/api/config")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

        // 2. Dashboard status (needs token) → API keys count
        if (token) {
          try {
            const resp = await fetch(
              `/api/dashboard/status?token=${encodeURIComponent(token)}`
            );
            if (resp.ok) {
              const data = await resp.json();
              setApiKeys(data?.apiKeys || null);
            }
          } catch {
            /* ignore */
          }
        } else {
          setApiKeys(null);
        }

        // 3. GitHub status (needs token + projectId)
        if (token && projectId) {
          try {
            const resp = await fetch(
              `/api/github/status?token=${encodeURIComponent(
                token
              )}&projectId=${encodeURIComponent(projectId)}`
            );
            if (resp.ok) {
              setGithub(await resp.json());
            }
          } catch {
            /* ignore */
          }

          // 4. Email sent count (from activity logs)
          try {
            const resp = await fetch(
              `/api/activity/logs?token=${encodeURIComponent(
                token
              )}&projectId=${encodeURIComponent(projectId)}`
            );
            if (resp.ok) {
              const data = await resp.json();
              const logs: Array<{ type?: string }> = Array.isArray(data?.logs)
                ? data.logs
                : [];
              setEmailSentCount(logs.filter((l) => l?.type === "email").length);
            }
          } catch {
            /* ignore */
          }
        } else {
          setGithub(null);
          setEmailSentCount(null);
        }

        const cfg = await configPromise;
        setConfig(cfg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, projectId]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ===== Derived values =====
  const aiConnected = !!apiKeys && apiKeys.total > 0;
  const githubConnected = !!github?.connected;
  const smtp = project?.leaderEmail ? detectSmtp(project.leaderEmail) : null;
  const tunnel = config ? detectTunnel(config.publicUrl) : null;
  const clientIdConfigured = !!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

  function handleRefresh() {
    notify.info("Đang làm mới trạng thái tích hợp...");
    loadAll(true);
  }

  function handleConnectGitHub() {
    if (!hasProject) {
      notify.warning("Cần chọn một dự án trước khi kết nối GitHub.");
      return;
    }
    const url = `/api/github/auth?token=${encodeURIComponent(
      token!
    )}&projectId=${encodeURIComponent(projectId!)}`;
    notify.info("Đang chuyển hướng đến GitHub OAuth...");
    window.location.href = url;
  }

  function handleDisconnectGitHub() {
    notify.warning("Tính năng ngắt kết nối chưa được triển khai.");
  }

  function handleViewSchema() {
    notify.info("Mở prisma/schema.prisma để xem 23 models.");
  }

  function handleCopyUrl() {
    if (config?.publicUrl) notify.copy(config.publicUrl, "Đã sao chép Public URL!");
  }

  if (loading) {
    return (
      <main className="flex-1 flex flex-col bg-nexus-bg/95 min-h-screen">
        <header className="sticky top-0 z-50 border-b border-border/40 bg-nexus-bg/90 backdrop-blur-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
            <button
              onClick={() => setView("home")}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Cpu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Plug className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">Tích hợp</h1>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-nexus-bg/95 min-h-screen nexus-boot">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-nexus-bg/90 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("home")}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Cpu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Plug className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">Tích hợp</h1>
              <Badge className="bg-primary/15 text-primary border-0 ml-1">6 dịch vụ</Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-muted-foreground hover:text-primary"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <AppSidebar active="integrations" />
        <div className="flex-1 overflow-y-auto nexus-scroll">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {/* Info banner */}
            {!hasProject && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/90">
                  Chưa chọn dự án — một số tích hợp (GitHub, SMTP) cần dự án đang hoạt động.
                  Dữ liệu AI/Tunnel/Mini-services/DB vẫn hiển thị.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* ===== Section 1: AI Provider (OpenRouter) ===== */}
              <IntegrationCard
                icon={Brain}
                iconColor="text-purple-400"
                iconBg="bg-purple-500/10"
                title="OpenRouter AI"
                subtitle="Nhà cung cấp mô hình AI"
                badge={<StatusBadge status={aiConnected ? "connected" : "disconnected"} />}
              >
                <Detail
                  label="Số API key"
                  value={
                    apiKeys
                      ? `${apiKeys.total} key${apiKeys.total !== 1 ? "s" : ""} đang hoạt động`
                      : "—"
                  }
                />
                <Detail
                  label="Multi-key rotation"
                  value={
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-0 text-[10px]">
                      BẬT
                    </Badge>
                  }
                />
                <Detail
                  label="Provider"
                  value={<span className="font-mono">{apiKeys?.provider || "openrouter"}</span>}
                  mono
                />

                <div className="mt-1">
                  <div className="text-[10px] text-muted-foreground/70 mb-1.5">
                    9 mô hình miễn phí đang dùng
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {FREE_MODELS.map((m) => (
                      <span
                        key={m}
                        className="text-[10px] font-mono bg-primary/8 text-primary/90 px-2 py-0.5 rounded-md border border-primary/15"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-auto pt-2 border-t border-border/30 space-y-2">
                  <Note icon={KeyRound}>
                    Thêm key vào{" "}
                    <code className="text-foreground/90 bg-secondary/40 px-1 rounded">.env</code>:{" "}
                    <code className="text-foreground/90 bg-secondary/40 px-1 rounded">
                      OPENROUTER_API_KEY
                    </code>
                    ,{" "}
                    <code className="text-foreground/90 bg-secondary/40 px-1 rounded">
                      OPENROUTER_API_KEY_2
                    </code>
                    …
                  </Note>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    openrouter.ai/keys
                  </a>
                </div>
              </IntegrationCard>

              {/* ===== Section 2: GitHub ===== */}
              <IntegrationCard
                icon={Github}
                iconColor="text-foreground"
                iconBg="bg-foreground/10"
                title="GitHub"
                subtitle="OAuth repository push"
                badge={<StatusBadge status={githubConnected ? "connected" : "disconnected"} />}
              >
                {!hasProject ? (
                  <div className="text-xs text-muted-foreground/70 italic">
                    Cần chọn dự án để xem trạng thái.
                  </div>
                ) : (
                  <>
                    <Detail
                      label="Tài khoản"
                      value={github?.username ? `@${github.username}` : "—"}
                      mono
                    />
                    <Detail label="Repository" value={github?.repoName || "—"} mono />
                    <Detail
                      label="Last push"
                      value={github?.pushedAt ? formatDate(github.pushedAt) : "—"}
                    />
                    <Detail
                      label="OAuth scope"
                      value={<code className="font-mono text-[11px]">repo</code>}
                      mono
                    />
                    <Detail
                      label="Client ID"
                      value={clientIdConfigured ? "Đã cấu hình" : "Chưa cấu hình"}
                    />

                    <div className="mt-auto pt-2 border-t border-border/30 flex items-center gap-2">
                      {!githubConnected ? (
                        <Button
                          size="sm"
                          className="bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20"
                          onClick={handleConnectGitHub}
                        >
                          <Github className="w-3.5 h-3.5" /> Kết nối GitHub
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={handleDisconnectGitHub}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Ngắt kết nối
                        </Button>
                      )}
                      <a
                        href="https://github.com/settings/connections/applications"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                      >
                        <Settings className="w-3 h-3" />
                        Cài đặt GitHub
                      </a>
                    </div>
                  </>
                )}
              </IntegrationCard>

              {/* ===== Section 3: SMTP / Email ===== */}
              <IntegrationCard
                icon={Mail}
                iconColor="text-rose-400"
                iconBg="bg-rose-500/10"
                title="SMTP / Email"
                subtitle="Gửi email mời thành viên & thông báo"
                badge={
                  <StatusBadge
                    status={hasProject && project?.leaderEmail ? "connected" : "partial"}
                  />
                }
              >
                <Detail
                  label="Email Leader"
                  value={project?.leaderEmail ? maskEmail(project.leaderEmail) : "—"}
                  mono
                />
                <Detail
                  label="SMTP Host"
                  value={smtp ? <span className="font-mono">{smtp.host}</span> : "—"}
                  mono
                />
                <Detail label="Port" value={smtp ? `${smtp.port} (TLS)` : "—"} mono />
                <Detail
                  label="SMTP Password"
                  value={project?.leaderEmail ? "••••••••••" : "—"}
                  mono
                />
                <Detail
                  label="Email đã gửi"
                  value={emailSentCount !== null ? `${emailSentCount} email` : "—"}
                />
                <Detail label="Cấu hình" value="Theo dự án (leader nhập khi tạo)" />

                <div className="mt-auto pt-2 border-t border-border/30">
                  <Note icon={Shield}>
                    Gmail yêu cầu <strong className="text-foreground/90">App Password</strong> —
                    tạo tại{" "}
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      myaccount.google.com/apppasswords <ArrowUpRight className="w-2.5 h-2.5" />
                    </a>
                  </Note>
                </div>
              </IntegrationCard>

              {/* ===== Section 4: Tunnel / Public URL ===== */}
              <IntegrationCard
                icon={Globe}
                iconColor="text-cyan-400"
                iconBg="bg-cyan-500/10"
                title="Tunnel / Public URL"
                subtitle="Truy cập công khai từ internet"
                badge={
                  <StatusBadge
                    status={
                      config && !config.isLocal
                        ? "connected"
                        : config && config.isLocal
                        ? "partial"
                        : "unknown"
                    }
                  />
                }
              >
                <Detail
                  label="Public URL"
                  value={
                    config ? (
                      <button
                        onClick={handleCopyUrl}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline"
                      >
                        {config.publicUrl}
                        <Copy className="w-3 h-3" />
                      </button>
                    ) : (
                      "—"
                    )
                  }
                  mono
                />
                <Detail
                  label="Tunnel mode"
                  value={tunnel ? <span className="font-mono">{tunnel.mode}</span> : "—"}
                  mono
                />
                <Detail label="Provider" value={tunnel?.provider || "—"} />
                <Detail
                  label="Loại"
                  value={config?.isLocal ? "Local (chỉ máy này)" : "Public"}
                />

                <div className="mt-auto pt-2 border-t border-border/30 space-y-1.5">
                  <Note icon={Settings}>
                    Sửa{" "}
                    <code className="text-foreground/90 bg-secondary/40 px-1 rounded">
                      tunnel.conf
                    </code>{" "}
                    để đổi chế độ (quick / ngrok / cloudflare-named).
                  </Note>
                  <Note icon={Mail}>
                    URL dùng cho email mời thành viên & truy cập thành viên từ bên ngoài.
                  </Note>
                </div>
              </IntegrationCard>

              {/* ===== Section 5: Mini-Services ===== */}
              <IntegrationCard
                icon={Boxes}
                iconColor="text-amber-400"
                iconBg="bg-amber-500/10"
                title="Mini-Services"
                subtitle="Socket.io realtime services"
                badge={<StatusBadge status="partial" />}
              >
                <div className="space-y-2.5">
                  {MINI_SERVICES.map((svc) => {
                    const Icon = svc.icon;
                    return (
                      <div
                        key={svc.name}
                        className="rounded-lg border border-border/40 bg-secondary/20 p-3"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div
                            className={`w-7 h-7 rounded-md ${svc.bg} flex items-center justify-center`}
                          >
                            <Icon className={`w-3.5 h-3.5 ${svc.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold">{svc.name}</span>
                              <code className="text-[10px] font-mono text-muted-foreground">
                                :{svc.port}
                              </code>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{svc.desc}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] text-muted-foreground/70">Events:</span>
                          {svc.events.map((ev) => (
                            <code
                              key={ev}
                              className="text-[9px] font-mono bg-primary/8 text-primary/90 px-1.5 py-0.5 rounded border border-primary/15"
                            >
                              {ev}
                            </code>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-auto pt-2 border-t border-border/30">
                  <Note icon={Terminal}>
                    Không thể phát hiện từ frontend — kiểm tra terminal để biết trạng thái
                    Running/Stopped.
                  </Note>
                </div>
              </IntegrationCard>

              {/* ===== Section 6: Database ===== */}
              <IntegrationCard
                icon={Database}
                iconColor="text-emerald-400"
                iconBg="bg-emerald-500/10"
                title="Database"
                subtitle="Cơ sở dữ liệu chính"
                badge={<StatusBadge status="connected" />}
              >
                <Detail label="Loại" value={<span className="font-mono">SQLite</span>} mono />
                <Detail
                  label="Đường dẫn"
                  value={<span className="font-mono">db/custom.db</span>}
                  mono
                />
                <Detail label="Số bảng" value="23 models" />
                <Detail label="Prisma" value={<span className="font-mono">v6.x</span>} mono />
                <Detail
                  label="Bảng chính"
                  value={<span className="text-[11px]">Project, Member, Analysis, Task, …</span>}
                />

                <div className="mt-auto pt-2 border-t border-border/30 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-primary hover:bg-primary/10"
                    onClick={handleViewSchema}
                  >
                    <Database className="w-3.5 h-3.5" /> Xem schema
                  </Button>
                  <span className="ml-auto text-[10px] text-muted-foreground/60 inline-flex items-center gap-1">
                    <Network className="w-3 h-3" /> Local file
                  </span>
                </div>
              </IntegrationCard>
            </div>

            {/* ===== Footer note ===== */}
            <div className="mt-6 rounded-xl border border-border/30 bg-secondary/20 px-4 py-3 flex items-start gap-2">
              <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-muted-foreground/80">
                Mọi tích hợp được quản lý qua{" "}
                <code className="text-foreground/90 bg-secondary/40 px-1 rounded">.env</code>,{" "}
                <code className="text-foreground/90 bg-secondary/40 px-1 rounded">tunnel.conf</code>,
                và{" "}
                <code className="text-foreground/90 bg-secondary/40 px-1 rounded">
                  prisma/schema.prisma
                </code>
                . Khởi động lại server sau khi thay đổi cấu hình.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
