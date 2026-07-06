"use client";

import { notify } from "@/lib/notify";
import { useState, useEffect } from "react";
import { useNexus } from "@/store/useNexus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Rocket,
  Plus,
  X,
  Users,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Cpu,
  Mail,
  User as UserIcon,
  Terminal,
  Loader2,
} from "lucide-react";
import { AI3DBrain } from "./AI3DBrain";
import { AppSidebar } from "./AppSidebar";

const STRENGTHS = [
  "Backend", "Frontend", "Database", "UI/UX", "Testing", "DevOps",
  "API Design", "Algorithm", "Mobile", "Security", "Documentation", "Leadership",
  "React", "Node.js", "Python", "SQL", "Docker", "Git", "Communication",
];

const WEAKNESSES = [
  "Weak CSS", "Weak DB", "Weak Algorithm", "Slow Learner",
  "Poor Communication", "No Experience", "Weak Testing", "Time Management",
  "Perfectionist", "Weak Frontend", "Weak Backend",
];

const TECHS = [
  "React", "Vue", "Angular", "Next.js", "Node.js", "Express",
  "Python", "Django", "FastAPI", "Java", "Spring Boot", "PHP", "Laravel",
  "Flutter", "React Native", "C#/.NET",
];

const LANGS = [
  "JavaScript", "TypeScript", "C#", "Python", "Java", "PHP",
  "Go", "Rust", "SQL", "HTML/CSS", "C++", "Swift", "Kotlin",
];

function toggleTag(value: string, tag: string): string {
  const items = (value || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (items.includes(tag)) {
    return items.filter((i) => i !== tag).join(", ");
  }
  return [...items, tag].join(", ");
}

export function InputView() {
  const input = useNexus((s) => s.input);
  const setInput = useNexus((s) => s.setInput);
  const setMember = useNexus((s) => s.setMember);
  const addMember = useNexus((s) => s.addMember);
  const removeMember = useNexus((s) => s.removeMember);
  const startPipeline = useNexus((s) => s.startPipeline);
  const setAgentStatus = useNexus((s) => s.setAgentStatus);
  const setPipelineError = useNexus((s) => s.setPipelineError);
  const setLogs = useNexus((s) => s.setLogs);
  const finishPipeline = useNexus((s) => s.finishPipeline);

  const [showOptional, setShowOptional] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [parallel, setParallel] = useState(true); // default: parallel (fast)

  // Warm up the /api/projects route on page load so Turbopack compiles it
  // before the user submits. Without this, the first POST can crash the server
  // because route compilation + Prisma + OpenRouter fetch happens simultaneously.
  useEffect(() => {
    fetch("/api/projects", { method: "HEAD" }).catch(() => {
      /* HEAD returns 405 but forces route compilation — that's the point */
    });
  }, []);

  function validate(): boolean {
    if (!input.topic.trim()) {
      notify.error("Vui long nhap ten chu de / du an");
      return false;
    }
    if (!input.leaderName.trim()) {
      notify.error("Vui long nhap ten nhom truong");
      return false;
    }
    const validMembers = input.members.filter((m) => m.name.trim());
    if (validMembers.length < 1) {
      notify.error("Can it nhat 1 thanh vien co ten");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const m of validMembers) {
      if (!m.email.trim()) {
        notify.error(`Thanh vien "${m.name}" thieu email de gui loi moi`);
        return false;
      }
      if (!emailRegex.test(m.email.trim())) {
        notify.error(`Email cua "${m.name}" khong hop le: ${m.email}`);
        return false;
      }
    }
    if (!input.leaderEmail.trim()) {
      notify.error("Vui long nhap email nhom truong (de gui mail SMTP)");
      return false;
    }
    if (!emailRegex.test(input.leaderEmail.trim())) {
      notify.error("Email nhom truong khong hop le");
      return false;
    }
    if (!input.leaderSmtpPassword.trim()) {
      notify.error("Vui long nhap App Password SMTP de gui email loi moi");
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    startPipeline();
    // Scroll to top so the ProcessingOverlay is immediately visible
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Build the payload
    const validMembers = input.members
      .filter((m) => m.name.trim() && m.email.trim())
      .map((m) => ({
        name: m.name.trim(),
        email: m.email.trim(),
        strengths: m.strengths.trim(),
        weaknesses: m.weaknesses.trim(),
      }));

    const payload = {
      topic: input.topic.trim(),
      description: input.description.trim(),
      purpose: input.purpose.trim(),
      extraInfo: {
        requirements: (Array.isArray(input.extraInfo.requirements)
          ? input.extraInfo.requirements.join("\n")
          : (input.extraInfo.requirements || "")
        ).split("\n").map((s: string) => s.trim()).filter(Boolean),
        specialReqs: (typeof input.extraInfo.specialReqs === "string" ? input.extraInfo.specialReqs : "").trim(),
        techPrefs: (Array.isArray(input.extraInfo.techPrefs)
          ? input.extraInfo.techPrefs.join(",")
          : (input.extraInfo.techPrefs || "")
        ).split(",").map((s: string) => s.trim()).filter(Boolean),
        langPrefs: (Array.isArray(input.extraInfo.langPrefs)
          ? input.extraInfo.langPrefs.join(",")
          : (input.extraInfo.langPrefs || "")
        ).split(",").map((s: string) => s.trim()).filter(Boolean),
      },
      members: validMembers,
      leaderName: input.leaderName.trim(),
      leaderEmail: input.leaderEmail.trim(),
      leaderSmtpPassword: input.leaderSmtpPassword.trim(),
      parallel,
    };

    try {
      // POST creates the project + starts the pipeline in the background.
      // Returns immediately with { projectId, leaderToken } — no SSE, no 504.
      const resp = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || err.details || `HTTP ${resp.status}`);
      }

      const data = (await resp.json()) as { projectId: string; leaderToken: string };
      const resultProjectId = data.projectId;
      const resultToken = data.leaderToken;

      if (!resultProjectId) throw new Error("Khong nhan duoc projectId");

      // ===== Poll for pipeline progress every 2.5 seconds =====
      await new Promise<void>((resolve, reject) => {
        const poll = async () => {
          try {
            const pr = await fetch(`/api/projects/${resultProjectId}/progress`);
            if (!pr.ok) {
              // 404 = progress expired or not found — check if project is ready
              if (pr.status === 404) {
                // Maybe pipeline finished and progress expired; redirect to workspace
                resolve();
                return;
              }
              throw new Error(`HTTP ${pr.status}`);
            }
            const prog = (await pr.json()) as {
              status: string;
              agents?: { id: string; status: string; error?: string }[];
              logs?: { id: string; ts: number; level: "info" | "success" | "warn" | "error"; agentId?: string; provider?: "openrouter" | "cache" | "fallback" | "pipeline"; model?: string; keyIndex?: number; message: string }[];
              error?: string;
            };

            // Update agent statuses in the overlay
            if (prog.agents) {
              for (const a of prog.agents) {
                if (a.status === "running") setAgentStatus(a.id, "running");
                else if (a.status === "done") setAgentStatus(a.id, "done");
                else if (a.status === "failed") setAgentStatus(a.id, "failed", a.error);
              }
            }

            // Sync live logs (replace full list each poll — backend keeps the source of truth)
            if (prog.logs) {
              setLogs(prog.logs);
            }

            if (prog.status === "done") {
              resolve();
            } else if (prog.status === "error") {
              reject(new Error(prog.error || "Pipeline that bai"));
            } else {
              // still running — poll again
              setTimeout(poll, 2500);
            }
          } catch (err) {
            reject(err instanceof Error ? err : new Error("Loi poll"));
          }
        };
        setTimeout(poll, 1000); // first poll after 1s
      });

      // Pipeline done — redirect to workspace
      localStorage.setItem(`nexus_leader_${resultProjectId}`, resultToken);
      notify.success("8 AI Agents hoan thanh! Email loi moi da gui thanh vien.");
      window.location.href = `/?p=${resultProjectId}&token=${resultToken}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Loi khong xac dinh";
      setPipelineError(msg);
      notify.error(msg);
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col bg-nexus-bg nexus-grid-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-nexus-bg/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center nexus-pulse-glow">
              <Cpu className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-primary">NEXUS</span> AI
              </h1>
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase">Multi-Agent Architect</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-primary/10 text-primary border-primary/20">Bước 1/8 · Nhập dữ liệu</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => useNexus.getState().setView("home")}
              className="text-muted-foreground hover:text-foreground"
            >
              ← Lịch sử
            </Button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar active="input" />
        <div className="flex-1 overflow-y-auto nexus-scroll">
          <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="nexus-boot space-y-6">
            {/* Premium Intro with 3D AI Brain + glow */}
            <div className="text-center mb-8 relative">
              {/* Glow aura behind title */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-gradient-to-r from-cyan-500/10 via-primary/15 to-emerald-500/10 blur-[80px] rounded-full animate-pulse pointer-events-none" />
              <div className="relative">
                <div className="flex justify-center mb-6">
                  <AI3DBrain size={100} />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 mb-4">
                  <Terminal className="w-3.5 h-3.5 text-primary nexus-spin-slow" />
                  <span className="text-[10px] font-mono text-primary tracking-wider">NEXUS_CORE // MULTI_AGENT_GATEWAY</span>
                </div>
                <h2 className="text-3xl font-bold mb-3 nexus-text-glow">
                  Khởi tạo dự án của bạn
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  10 AI Agent sẽ phân tích chủ đề, phân nhân sự, lập sprint, thiết kế hệ thống, vẽ UML,
                  viết tài liệu, sinh test plan, review security và git workflow. Sau đó email lời mời tự động gửi thành viên.
                </p>
              </div>
            </div>

            {/* Basic info */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderOpen className="w-4 h-4 text-primary" />
                  Thong tin co ban
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Ten chu de / Du an *
                  </label>
                  <Input
                    value={input.topic}
                    onChange={(e) => setInput({ topic: e.target.value })}
                    placeholder="VD: He thong quan ly nhan su, E-commerce, LMS..."
                    className="text-base bg-nexus-surface-2 border-border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Mo ta du an
                  </label>
                  <Textarea
                    value={input.description}
                    onChange={(e) => setInput({ description: e.target.value })}
                    rows={3}
                    placeholder="Mo ta chi tiet: nguoi dung cuoi la ai, giai quyet van de gi, quy mo nao..."
                    className="bg-nexus-surface-2 border-border"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Muc dich du an
                    </label>
                    <Input
                      value={input.purpose}
                      onChange={(e) => setInput({ purpose: e.target.value })}
                      placeholder="VD: Do an tot nghiep, Hackathon, San pham thuc te..."
                      className="bg-nexus-surface-2 border-border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Ten nhom truong *
                    </label>
                    <Input
                      value={input.leaderName}
                      onChange={(e) => setInput({ leaderName: e.target.value })}
                      placeholder="Ten cua ban (nhom truong)"
                      className="bg-nexus-surface-2 border-border"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Email nhom truong (GUI MAIL SMTP) *
                    </label>
                    <Input
                      type="email"
                      value={input.leaderEmail}
                      onChange={(e) => setInput({ leaderEmail: e.target.value })}
                      placeholder="nhomtruong@gmail.com"
                      className="bg-nexus-surface-2 border-border"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Email nay se dung de GUI email loi moi den thanh vien qua SMTP.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      App Password (SMTP) *
                    </label>
                    <Input
                      type="password"
                      value={input.leaderSmtpPassword}
                      onChange={(e) => setInput({ leaderSmtpPassword: e.target.value })}
                      placeholder="16 ky tu app password"
                      className="bg-nexus-surface-2 border-border font-mono"
                      maxLength={32}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Gmail App Password — lay tai{" "}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        myaccount.google.com/apppasswords
                      </a>{" "}
                      (bat 2FA truoc).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Optional info */}
            <Card className="bg-card border-border">
              <button
                onClick={() => setShowOptional((v) => !v)}
                className="w-full flex items-center gap-2 px-6 py-4 text-left hover:bg-secondary/30 transition-colors"
              >
                {showOptional ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-muted-foreground">
                  Thong tin bo sung (nhan de mo rong)
                </span>
              </button>
              {showOptional && (
                <CardContent className="space-y-4 nexus-fade">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Chuc nang yeu cau (moi dong 1 chuc nang)
                    </label>
                    <Textarea
                      value={input.extraInfo.requirements || ""}
                      onChange={(e) =>
                        setInput({ extraInfo: { ...input.extraInfo, requirements: e.target.value } })
                      }
                      rows={4}
                      placeholder={"Dang nhap / Dang xuat / Phan quyen\nQuan ly nhan vien CRUD\nCham cong / Nghi phep\nBao cao thong ke..."}
                      className="bg-nexus-surface-2 border-border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Yeu cau dac biet
                    </label>
                    <Textarea
                      value={input.extraInfo.specialReqs || ""}
                      onChange={(e) =>
                        setInput({ extraInfo: { ...input.extraInfo, specialReqs: e.target.value } })
                      }
                      rows={2}
                      placeholder="Multi-language, Dark mode, Responsive, PWA, Real-time notification..."
                      className="bg-nexus-surface-2 border-border"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Cong nghe mong muon (chon tag hoac nhap tay)
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {TECHS.map((t) => (
                          <button
                            key={t}
                            onClick={() =>
                              setInput({
                                extraInfo: {
                                  ...input.extraInfo,
                                  techPrefs: toggleTag(input.extraInfo.techPrefs, t),
                                },
                              })
                            }
                            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                              (input.extraInfo.techPrefs || "").includes(t)
                                ? "bg-primary/15 border-primary text-primary"
                                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        value={input.extraInfo.techPrefs || ""}
                        onChange={(e) =>
                          setInput({ extraInfo: { ...input.extraInfo, techPrefs: e.target.value } })
                        }
                        rows={1}
                        placeholder="Nhap them cong nghe khac (phan cach bang dau phay)..."
                        className="bg-nexus-surface-2 border-border text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Ngon ngu lap trinh (chon tag hoac nhap tay)
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {LANGS.map((t) => (
                          <button
                            key={t}
                            onClick={() =>
                              setInput({
                                extraInfo: {
                                  ...input.extraInfo,
                                  langPrefs: toggleTag(input.extraInfo.langPrefs, t),
                                },
                              })
                            }
                            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                              (input.extraInfo.langPrefs || "").includes(t)
                                ? "bg-primary/15 border-primary text-primary"
                                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        value={input.extraInfo.langPrefs || ""}
                        onChange={(e) =>
                          setInput({ extraInfo: { ...input.extraInfo, langPrefs: e.target.value } })
                        }
                        rows={1}
                        placeholder="Nhap them ngon ngu khac (phan cach bang dau phay)..."
                        className="bg-nexus-surface-2 border-border text-xs"
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Members */}
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Users className="w-4 h-4 text-primary" />
                Thanh vien (se nhan email loi moi)
              </h3>
              <Button variant="secondary" size="sm" onClick={addMember}>
                <Plus className="w-4 h-4" /> Them thanh vien
              </Button>
            </div>

            <div className="space-y-3">
              {input.members.map((m, i) => (
                <Card key={i} className="bg-card border-border nexus-fade">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-primary font-mono text-sm font-semibold">
                        #{i + 1}
                      </span>
                      {input.members.length > 1 && (
                        <button
                          onClick={() => removeMember(i)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                          <UserIcon className="w-3 h-3" /> Ten thanh vien
                        </label>
                        <Input
                          value={m.name}
                          onChange={(e) => setMember(i, { name: e.target.value })}
                          placeholder="Nguyen Van A"
                          className="bg-nexus-surface-2 border-border"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> Email (nhan loi moi)
                        </label>
                        <Input
                          type="email"
                          value={m.email}
                          onChange={(e) => setMember(i, { email: e.target.value })}
                          placeholder="a@example.com"
                          className="bg-nexus-surface-2 border-border"
                        />
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Uu diem (chon tag hoac nhap tay)
                        </label>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {STRENGTHS.slice(0, 8).map((t) => (
                            <button
                              key={t}
                              onClick={() => setMember(i, { strengths: toggleTag(m.strengths, t) })}
                              className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                                m.strengths.includes(t)
                                  ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                                  : "border-border text-muted-foreground hover:border-emerald-500 hover:text-emerald-400"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        <Textarea
                          value={m.strengths}
                          onChange={(e) => setMember(i, { strengths: e.target.value })}
                          rows={2}
                          placeholder="Nhap them uu diem (phan cach bang dau phay)..."
                          className="bg-nexus-surface-2 border-border text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Nhuoc diem (chon tag hoac nhap tay)
                        </label>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {WEAKNESSES.slice(0, 6).map((t) => (
                            <button
                              key={t}
                              onClick={() => setMember(i, { weaknesses: toggleTag(m.weaknesses, t) })}
                              className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                                m.weaknesses.includes(t)
                                  ? "bg-destructive/15 border-destructive text-destructive"
                                  : "border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        <Textarea
                          value={m.weaknesses}
                          onChange={(e) => setMember(i, { weaknesses: e.target.value })}
                          rows={2}
                          placeholder="Nhap them nhuoc diem (phan cach bang dau phay)..."
                          className="bg-nexus-surface-2 border-border text-xs"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pipeline mode toggle + Submit */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 pb-8">
              {/* Parallel vs Sequential toggle */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Chế độ chạy pipeline</span>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/30 border border-border">
                  <button
                    type="button"
                    onClick={() => setParallel(true)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      parallel
                        ? "bg-primary text-primary-foreground nexus-glow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ⚡ Song song (nhanh)
                  </button>
                  <button
                    type="button"
                    onClick={() => setParallel(false)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      !parallel
                        ? "bg-primary text-primary-foreground nexus-glow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🐢 Tuần tự (ổn định)
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground/70">
                  {parallel
                    ? "Chạy nhiều agent cùng lúc — nhanh nhưng dễ bị rate-limit (429)"
                    : "Chạy từng agent một — chậm hơn nhưng tránh dồn dập API"}
                </span>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
                className="bg-gradient-to-r from-primary to-cyan-500 text-primary-foreground hover:opacity-90 px-8 nexus-glow-strong transition-all hover:translate-x-0.5 active:translate-x-0"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Rocket className="w-4 h-4" />
                )}
                Khởi tạo Dự Án
              </Button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </main>
  );
}
