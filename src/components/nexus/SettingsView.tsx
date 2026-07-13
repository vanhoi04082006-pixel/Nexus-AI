"use client";

import { notify } from "@/lib/notify";
import { useEffect, useState, useCallback, useRef } from "react";
import { useNexus } from "@/store/useNexus";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Settings as SettingsIcon,
  Server,
  Brain,
  Zap,
  Palette,
  Database,
  Cpu,
  Globe,
  HardDrive,
  KeyRound,
  Thermometer,
  RefreshCw,
  Clock,
  ShieldCheck,
  Trash2,
  Download,
  AlertTriangle,
  Moon,
  Sparkles,
  Volume2,
  Languages,
  CheckCircle2,
  Loader2,
  Copy,
  ExternalLink,
  Activity,
  Power,
  Timer,
  Layers,
  Boxes,
  Users,
  CheckSquare,
  FileSearch,
} from "lucide-react";

// ===== Types =====
interface ConfigData {
  publicUrl: string;
  isLocal: boolean;
}

interface SystemStatus {
  agents: { total: number; online: number; offline: number; busy: number; idle: number; error: number };
  apiKeys: { total: number; active: number; expired: number; nearQuota: number; provider: string };
  pipeline: { status: string; currentAgent: string; progress: number; stage: string };
  database: { status: string; details: string };
  redis: { status: string; details: string };
  vectorDb: { status: string; details: string };
  storage: { status: string; details: string };
}

interface ProjectItem {
  id: string;
  topic: string;
  leaderToken: string;
  memberCount: number;
  taskCount: number;
  hasAnalysis: boolean;
}

// ===== Static config =====
const APP_VERSION = "0.2.0";
const NEXTJS_VERSION = "16.1.3";
const NODE_VERSION = "v20.18.0 LTS";
const BUN_VERSION = "v1.1.38";
const DB_PATH = "db/custom.db";

const FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "deepseek/deepseek-r1:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemma-2-9b-it:free",
  "microsoft/phi-3-medium-4k-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
];

const AGENT_TEMPS = [
  { role: "Requirement Analyst", temp: 0.4 },
  { role: "HR Planner", temp: 0.5 },
  { role: "Sprint Planner", temp: 0.5 },
  { role: "System Architect", temp: 0.3 },
  { role: "UML Generator", temp: 0.3 },
  { role: "Technical Writer", temp: 0.4 },
  { role: "Git / DevOps", temp: 0.2 },
  { role: "Software Tester", temp: 0.2 },
  { role: "Security Reviewer", temp: 0.2 },
  { role: "Quality Reviewer", temp: 0.3 },
];

interface PipelineSettings {
  parallelMode: boolean;
  liveLogConsole: boolean;
  autoSaveResults: boolean;
  sendInvitationEmails: boolean;
}

interface UIPreferences {
  darkMode: boolean;
  animations: boolean;
  soundNotifications: boolean;
}

const DEFAULT_PIPELINE: PipelineSettings = {
  parallelMode: true,
  liveLogConsole: true,
  autoSaveResults: true,
  sendInvitationEmails: true,
};

const DEFAULT_UI: UIPreferences = {
  darkMode: true,
  animations: true,
  soundNotifications: false,
};

const SETTINGS_KEY = "nexus-settings";

function loadSettings(): { pipeline: PipelineSettings; ui: UIPreferences } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        pipeline: { ...DEFAULT_PIPELINE, ...(parsed.pipeline || {}) },
        ui: { ...DEFAULT_UI, ...(parsed.ui || {}) },
      };
    }
  } catch {
    /* ignore */
  }
  return { pipeline: DEFAULT_PIPELINE, ui: DEFAULT_UI };
}

// ===== Reusable bits =====
function SectionCard({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof Server;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-card/60 backdrop-blur-xl border-border/40 shadow-lg shadow-black/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/12 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base text-foreground">{title}</CardTitle>
            {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">{children}</CardContent>
    </Card>
  );
}

function Row({
  icon: Icon,
  label,
  desc,
  children,
}: {
  icon?: typeof Server;
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/20 last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        <div className="min-w-0">
          <div className="text-sm text-foreground truncate">{label}</div>
          {desc && <div className="text-[11px] text-muted-foreground truncate">{desc}</div>}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "connected" || status === "online" || status === "ready" || status === "idle";
  const color = ok
    ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
    : status === "running" || status === "busy"
    ? "text-amber-400 bg-amber-500/15 border-amber-500/30"
    : "text-red-400 bg-red-500/15 border-red-500/30";
  return (
    <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${color}`}>
      {status}
    </Badge>
  );
}

// ===== Main =====
export function SettingsView() {
  const token = useNexus((s) => s.token);

  const [config, setConfig] = useState<ConfigData | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [pipeline, setPipeline] = useState<PipelineSettings>(DEFAULT_PIPELINE);
  const [ui, setUI] = useState<UIPreferences>(DEFAULT_UI);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const cancelledRef = useRef(false);

  // Load persisted settings on mount
  useEffect(() => {
    const s = loadSettings();
    setPipeline(s.pipeline);
    setUI(s.ui);
  }, []);

  // Persist settings on change
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ pipeline, ui }));
    } catch {
      /* ignore */
    }
  }, [pipeline, ui]);

  // Fetch /api/config
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/config");
        if (resp.ok && !cancelled) setConfig(await resp.json());
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch projects → use first leaderToken for dashboard status
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const pResp = await fetch("/api/projects");
      const pData = pResp.ok ? await pResp.json() : { projects: [] };
      const list: ProjectItem[] = pData.projects || [];
      if (!cancelledRef.current) setProjects(list);

      const t = token || list[0]?.leaderToken;
      if (t) {
        const sResp = await fetch(`/api/dashboard/status?token=${encodeURIComponent(t)}`);
        if (sResp.ok && !cancelledRef.current) setStatus(await sResp.json());
      }
    } catch {
      /* ignore */
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cancelledRef.current = false;
    loadAll();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadAll]);

  // ===== Handlers =====
  function clearLocalStorage() {
    try {
      localStorage.removeItem("nexus-storage");
      localStorage.removeItem(SETTINGS_KEY);
      notify.success("Đã xoá local storage. Đang tải lại...");
      setTimeout(() => window.location.reload(), 800);
    } catch {
      notify.error("Không thể xoá local storage");
    }
  }

  function exportProjects() {
    notify.info("Tính năng xuất dự án — coming soon!");
  }

  async function clearCaches() {
    const id = "clear-caches";
    notify.loading("Đang xoá cache...", { id });
    try {
      await fetch("/api/config", { method: "POST" });
      notify.update(id, "Cache (deadModels, circuitBreakers, aiCache) — endpoint chưa triển khai", "info");
    } catch {
      notify.update(id, "Không thể xoá cache", "error");
    }
  }

  function openReset() {
    setResetConfirm("");
    setResetOpen(true);
  }

  function confirmReset() {
    if (resetConfirm.trim().toUpperCase() !== "RESET") {
      notify.error('Vui lòng gõ "RESET" để xác nhận');
      return;
    }
    setResetOpen(false);
    notify.warning("Lệnh `bun run db:reset` không thể chạy từ frontend. Vui lòng chạy trong terminal server.");
  }

  const dbStats = {
    projects: projects.length,
    members: projects.reduce((a, p) => a + (p.memberCount || 0), 0),
    tasks: projects.reduce((a, p) => a + (p.taskCount || 0), 0),
    analyses: projects.filter((p) => p.hasAnalysis).length,
  };

  const apiKeys = status?.apiKeys.total ?? 0;

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar active="settings" />
      <main className="flex-1 overflow-y-auto nexus-scroll">
        <div className="max-w-[800px] mx-auto px-4 md:px-6 py-6 md:py-10 space-y-5">
          {/* ===== Header ===== */}
          <div className="flex items-center gap-3 pb-2">
            <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Cài đặt hệ thống</h1>
              <p className="text-xs text-muted-foreground">
                Cấu hình NEXUS AI Multi-Agent · v{APP_VERSION}
              </p>
            </div>
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Làm mới
              </Button>
            </div>
          </div>

          {/* ===== Section 1: System Info ===== */}
          <SectionCard icon={Server} title="Thông tin hệ thống" desc="Phiên bản, runtime và endpoint công khai">
            <Row icon={Activity} label="App version">
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                v{APP_VERSION}
              </Badge>
            </Row>
            <Row icon={Cpu} label="Next.js">
              <span className="text-sm text-muted-foreground font-mono">{NEXTJS_VERSION}</span>
            </Row>
            <Row icon={Cpu} label="Node.js">
              <span className="text-sm text-muted-foreground font-mono">{NODE_VERSION}</span>
            </Row>
            <Row icon={Cpu} label="Bun">
              <span className="text-sm text-muted-foreground font-mono">{BUN_VERSION}</span>
            </Row>
            <Row icon={Database} label="Đường dẫn DB">
              <span className="text-sm text-muted-foreground font-mono">{DB_PATH}</span>
            </Row>
            <Row icon={HardDrive} label="Kích thước DB">
              <span className="text-sm text-muted-foreground">— (server-side)</span>
            </Row>
            <Row icon={Globe} label="Public URL" desc={config ? (config.isLocal ? "Local environment" : "Tunnel / production") : "Đang tải..."}>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-mono max-w-[280px] truncate">
                  {config?.publicUrl ?? "—"}
                </span>
                {config?.publicUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => notify.copy(config.publicUrl)}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </Row>
            <Row icon={Database} label="Trạng thái Database">
              <StatusBadge status={status?.database?.status ?? "unknown"} />
            </Row>
            <Row icon={Zap} label="Trạng thái Pipeline">
              <StatusBadge status={status?.pipeline?.status ?? "unknown"} />
            </Row>
            <Row icon={Brain} label="Số lượng Agent">
              <Badge variant="secondary" className="font-mono">
                {status?.agents.total ?? 10} agents
              </Badge>
            </Row>
          </SectionCard>

          {/* ===== Section 2: AI Configuration ===== */}
          <SectionCard icon={Brain} title="Cấu hình AI" desc="OpenRouter, models, temperature và circuit breaker">
            <Row icon={KeyRound} label="OpenRouter API Keys" desc="Số lượng key đã cấu hình">
              <Badge variant="outline" className="text-cyan-400 border-cyan-500/30 bg-cyan-500/10">
                {apiKeys} key{apiKeys === 1 ? "" : "s"}
              </Badge>
            </Row>
            <Row icon={Layers} label="Default models (9 free)" desc="Danh sách model mặc định">
              <Badge variant="secondary">{FREE_MODELS.length} models</Badge>
            </Row>
            <div className="pt-1 pb-2">
              <div className="flex flex-wrap gap-1.5">
                {FREE_MODELS.map((m) => (
                  <span
                    key={m}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted/40 border border-border/40 text-muted-foreground"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <Row icon={Thermometer} label="Temperature theo Agent" desc="Hiển thị (không chỉnh sửa)">
              <Badge variant="secondary">10 roles</Badge>
            </Row>
            <div className="pt-1 pb-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {AGENT_TEMPS.map((a) => (
                <div key={a.role} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground truncate pr-2">{a.role}</span>
                  <span className="font-mono text-foreground">{a.temp.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <Row icon={RefreshCw} label="Max retries / Rate limit delay">
              <span className="text-sm text-muted-foreground font-mono">5 · 60s</span>
            </Row>
            <Row icon={Layers} label="Max concurrency">
              <span className="text-sm text-muted-foreground font-mono">3</span>
            </Row>
            <Row icon={ShieldCheck} label="Circuit breaker" desc="Ngưỡng lỗi / cooldown">
              <span className="text-sm text-muted-foreground font-mono">3 fail · 3 min</span>
            </Row>
            <Row icon={Power} label="Dead model cooldown">
              <span className="text-sm text-muted-foreground font-mono">2 min</span>
            </Row>
            <Row icon={Timer} label="Prompt cache TTL">
              <span className="text-sm text-muted-foreground font-mono">1 hour</span>
            </Row>
          </SectionCard>

          {/* ===== Section 3: Pipeline Settings ===== */}
          <SectionCard icon={Zap} title="Cài đặt Pipeline" desc="Chế độ chạy, logging và lưu kết quả">
            <Row icon={Layers} label="Parallel mode" desc="Chạy nhiều agent song song">
              <Switch
                checked={pipeline.parallelMode}
                onCheckedChange={(v) => setPipeline((p) => ({ ...p, parallelMode: v }))}
              />
            </Row>
            <Row icon={Activity} label="Live Log Console" desc="Hiển thị log theo thời gian thực">
              <Switch
                checked={pipeline.liveLogConsole}
                onCheckedChange={(v) => setPipeline((p) => ({ ...p, liveLogConsole: v }))}
              />
            </Row>
            <Row icon={Database} label="Tự động lưu kết quả" desc="Lưu output vào DB">
              <Switch
                checked={pipeline.autoSaveResults}
                onCheckedChange={(v) => setPipeline((p) => ({ ...p, autoSaveResults: v }))}
              />
            </Row>
            <Row icon={ExternalLink} label="Gửi email mời" desc="Gửi invitation cho thành viên">
              <Switch
                checked={pipeline.sendInvitationEmails}
                onCheckedChange={(v) => setPipeline((p) => ({ ...p, sendInvitationEmails: v }))}
              />
            </Row>
            <Row icon={Activity} label="Max log lines">
              <span className="text-sm text-muted-foreground font-mono">2000</span>
            </Row>
            <Row icon={Clock} label="Pipeline timeout">
              <span className="text-sm text-muted-foreground font-mono">60 min</span>
            </Row>
            <Row icon={Clock} label="Init timeout">
              <span className="text-sm text-muted-foreground font-mono">20 min</span>
            </Row>
          </SectionCard>

          {/* ===== Section 4: UI Preferences ===== */}
          <SectionCard icon={Palette} title="Tuỳ chỉnh giao diện" desc="Theme, hiệu ứng và ngôn ngữ">
            <Row icon={Moon} label="Dark mode" desc="Luôn bật trong phiên bản hiện tại">
              <Switch checked={ui.darkMode} disabled />
            </Row>
            <Row icon={Sparkles} label="Animations" desc="Hiệu ứng chuyển động">
              <Switch
                checked={ui.animations}
                onCheckedChange={(v) => setUI((p) => ({ ...p, animations: v }))}
              />
            </Row>
            <Row icon={Volume2} label="Sound notifications" desc="Âm thanh khi hoàn thành">
              <Switch
                checked={ui.soundNotifications}
                onCheckedChange={(v) => setUI((p) => ({ ...p, soundNotifications: v }))}
              />
            </Row>
            <Row icon={Languages} label="Ngôn ngữ" desc="Hiển thị (không đổi được)">
              <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10">
                Tiếng Việt
              </Badge>
            </Row>
            <Row icon={Trash2} label="Xoá local storage" desc="Reset toàn bộ dữ liệu trình duyệt">
              <Button variant="outline" size="sm" onClick={clearLocalStorage} className="text-red-400 border-red-500/30 hover:bg-red-500/10">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Clear
              </Button>
            </Row>
          </SectionCard>

          {/* ===== Section 5: Data Management ===== */}
          <SectionCard icon={Database} title="Quản lý dữ liệu" desc="Export, cache và reset database">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2">
              <div className="rounded-lg bg-muted/30 border border-border/30 p-2.5 text-center">
                <Boxes className="w-4 h-4 mx-auto mb-1 text-cyan-400" />
                <div className="text-lg font-bold text-foreground">{dbStats.projects}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Dự án</div>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/30 p-2.5 text-center">
                <Users className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                <div className="text-lg font-bold text-foreground">{dbStats.members}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Thành viên</div>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/30 p-2.5 text-center">
                <CheckSquare className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                <div className="text-lg font-bold text-foreground">{dbStats.tasks}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Task</div>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/30 p-2.5 text-center">
                <FileSearch className="w-4 h-4 mx-auto mb-1 text-purple-400" />
                <div className="text-lg font-bold text-foreground">{dbStats.analyses}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Analysis</div>
              </div>
            </div>
            <Row icon={Download} label="Export tất cả dự án" desc="Xuất ra file JSON / CSV">
              <Button variant="outline" size="sm" onClick={exportProjects}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export
              </Button>
            </Row>
            <Row icon={RefreshCw} label="Xoá tất cả cache" desc="deadModels · circuitBreakers · aiCache">
              <Button variant="outline" size="sm" onClick={clearCaches}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Clear
              </Button>
            </Row>
            <Row icon={AlertTriangle} label="Reset database" desc="Xoá toàn bộ dữ liệu — không hoàn tác">
              <Button variant="outline" size="sm" onClick={openReset} className="text-red-400 border-red-500/30 hover:bg-red-500/10">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                Reset
              </Button>
            </Row>
          </SectionCard>

          {/* Footer note */}
          <div className="flex items-center justify-center gap-1.5 pt-2 pb-4 text-[11px] text-muted-foreground/60">
            <CheckCircle2 className="w-3 h-3" />
            <span>
              NEXUS AI Multi-Agent · Cấu hình được lưu trong <code className="font-mono">nexus-settings</code>
            </span>
          </div>
        </div>
      </main>

      {/* ===== Reset confirmation dialog ===== */}
      {resetOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setResetOpen(false)} />
          <Card className="relative w-full max-w-md bg-card/95 backdrop-blur-2xl border-red-500/40 shadow-2xl shadow-red-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-base text-red-400">Reset Database</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Hành động này không thể hoàn tác</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Toàn bộ dự án, thành viên, task và phân tích sẽ bị xoá vĩnh viễn. Lệnh này chạy{" "}
                <code className="font-mono text-foreground">bun run db:reset</code> trên server.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Nhập <span className="font-mono text-red-400 font-bold">RESET</span> để xác nhận:
                </label>
                <Input
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  placeholder="RESET"
                  className="font-mono"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setResetOpen(false)}>
                  Huỷ
                </Button>
                <Button
                  size="sm"
                  onClick={confirmReset}
                  className="bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Xác nhận reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading overlay (initial) */}
      {loading && !status && !config && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-card/90 backdrop-blur-xl border border-border/40 shadow-lg">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground">Đang tải cấu hình...</span>
        </div>
      )}
    </div>
  );
}
