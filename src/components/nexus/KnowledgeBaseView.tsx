"use client";

import { notify } from "@/lib/notify";
import { useEffect, useState, useMemo } from "react";
import { useNexus } from "@/store/useNexus";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Terminal,
  Cpu,
  Search,
  Loader2,
  ArrowRight,
  Code2,
  ShoppingBag,
  Settings,
  Smartphone,
  Sparkles,
  Brain,
  Zap,
  Activity,
  ShieldCheck,
  GitBranch,
  FileText,
  ClipboardCheck,
  Users,
  Calendar,
  Boxes,
  Database,
  Server,
  HardDrive,
  Layers,
  RefreshCw,
} from "lucide-react";
import { AppSidebar } from "./AppSidebar";

/* ============================================================
   Types
============================================================ */

interface TemplateItem {
  id: string;
  name: string;
  desc: string;
  category: string;
  icon: string;
  color: string;
  iconColor: string;
  border: string;
  topic: string;
  description: string;
  purpose: string;
  techPrefs: string;
  langPrefs: string;
}

interface AgentDoc {
  id: string;
  name: string;
  role: string;
  section: string;
  sectionLabel: string;
  icon: typeof Brain;
  iconColor: string;
  border: string;
  gradient: string;
  models: string[];
  description: string;
  skills: string[];
}

interface TechStackGroup {
  title: string;
  icon: typeof Code2;
  iconColor: string;
  border: string;
  gradient: string;
  items: { name: string; note: string }[];
}

/* ============================================================
   Icon map for templates (API returns icon names as strings)
============================================================ */

const TEMPLATE_ICON_MAP: Record<string, typeof Code2> = {
  Code2,
  ShoppingBag,
  Settings,
  Smartphone,
  Sparkles,
  Brain,
  Terminal,
  Zap,
  Cpu,
  Activity,
};

/* ============================================================
   Static AI Agents Reference (10 agents)
   Models reflect each agent's primary model family per spec.
============================================================ */

const AI_AGENTS: AgentDoc[] = [
  {
    id: "01",
    name: "Requirement Analyst",
    role: "Business Analyst",
    section: "analysis",
    sectionLabel: "Phân tích yêu cầu",
    icon: Activity,
    iconColor: "text-cyan-400",
    border: "border-cyan-500/30",
    gradient: "from-cyan-500/15 to-blue-900/5",
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
    ],
    description:
      "Phân tích yêu cầu dự án, đề xuất tech stack, features, actors và modules. Đầu vào chính cho toàn bộ pipeline.",
    skills: ["Analysis", "Planning", "Documentation", "Stakeholder Mapping"],
  },
  {
    id: "02",
    name: "HR Planner",
    role: "HR Manager",
    section: "hr",
    sectionLabel: "Phân bổ nhân sự",
    icon: Users,
    iconColor: "text-emerald-400",
    border: "border-emerald-500/30",
    gradient: "from-emerald-500/15 to-teal-900/5",
    models: [
      "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free",
    ],
    description:
      "Phân vai trò, workload và rủi ro cho từng thành viên trong dự án dựa trên strengths/weaknesses.",
    skills: ["HR Planning", "Risk Assessment", "Workload Balancing"],
  },
  {
    id: "03",
    name: "Sprint Planner",
    role: "Scrum Master",
    section: "sprint",
    sectionLabel: "Lập kế hoạch Sprint",
    icon: Calendar,
    iconColor: "text-amber-400",
    border: "border-amber-400/30",
    gradient: "from-amber-400/15 to-orange-900/5",
    models: [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
    ],
    description:
      "Chia sprint, gán task theo thành viên, đặt deadline và milestones theo phương pháp Agile/Scrum.",
    skills: ["Agile", "Sprint Planning", "Timeline", "Milestones"],
  },
  {
    id: "04",
    name: "System Architect",
    role: "Software Architect",
    section: "design",
    sectionLabel: "Thiết kế hệ thống",
    icon: Boxes,
    iconColor: "text-purple-400",
    border: "border-purple-500/30",
    gradient: "from-purple-500/15 to-indigo-900/5",
    models: ["openai/gpt-oss-120b:free"],
    description:
      "Thiết kế DB schema, API endpoints và folder structure. Áp dụng DDD và best practices kiến trúc.",
    skills: ["Architecture", "Database", "API Design", "DDD"],
  },
  {
    id: "05",
    name: "UML Generator",
    role: "UML Expert",
    section: "uml",
    sectionLabel: "Sinh sơ đồ UML",
    icon: Layers,
    iconColor: "text-rose-400",
    border: "border-rose-500/30",
    gradient: "from-rose-500/15 to-pink-900/5",
    models: ["openai/gpt-oss-120b:free", "qwen/qwen3-coder:free"],
    description:
      "Sinh 4 diagram chuẩn Mermaid: Use Case, Class, ERD và Sequence Diagram từ output của Architect.",
    skills: ["UML", "Mermaid", "Diagramming", "Visual Modeling"],
  },
  {
    id: "06",
    name: "Technical Writer",
    role: "Tech Writer",
    section: "docs",
    sectionLabel: "Tài liệu kỹ thuật",
    icon: FileText,
    iconColor: "text-blue-400",
    border: "border-blue-500/30",
    gradient: "from-blue-500/15 to-cyan-900/5",
    models: [
      "google/gemma-4-31b-it:free",
      "google/gemma-4-26b-a4b-it:free",
    ],
    description:
      "Viết README.md, Coding Convention và API Standard cho dự án. Markdown chuẩn, có mục lục rõ ràng.",
    skills: ["Documentation", "Markdown", "Technical Writing"],
  },
  {
    id: "07",
    name: "Git / DevOps",
    role: "DevOps Engineer",
    section: "git",
    sectionLabel: "Git & DevOps",
    icon: GitBranch,
    iconColor: "text-orange-400",
    border: "border-orange-500/30",
    gradient: "from-orange-500/15 to-amber-900/5",
    models: ["cohere/north-mini-code:free"],
    description:
      "Đề xuất Git commands, branch strategy (Git Flow / Trunk Based), issue template và CI/CD pipeline.",
    skills: ["Git", "Docker", "CI/CD", "DevOps"],
  },
  {
    id: "08",
    name: "Software Tester",
    role: "QA Engineer",
    section: "test",
    sectionLabel: "Kiểm thử phần mềm",
    icon: ClipboardCheck,
    iconColor: "text-teal-400",
    border: "border-teal-500/30",
    gradient: "from-teal-500/15 to-cyan-900/5",
    models: ["qwen/qwen3-coder:free"],
    description:
      "Sinh test plan đầy đủ: unit, integration, E2E, API và performance tests dựa trên API endpoints.",
    skills: ["Testing", "QA", "Automation", "Performance"],
  },
  {
    id: "09",
    name: "Security Reviewer",
    role: "Security Architect",
    section: "security",
    sectionLabel: "Rà soát bảo mật",
    icon: ShieldCheck,
    iconColor: "text-red-400",
    border: "border-red-500/30",
    gradient: "from-red-500/15 to-rose-900/5",
    models: ["openai/gpt-oss-120b:free"],
    description:
      "Phân tích threats, auth flow, OWASP Top 10, rate limiting và encryption cho dự án.",
    skills: ["Security", "OWASP", "Auth", "Encryption"],
  },
  {
    id: "10",
    name: "Quality Reviewer",
    role: "Senior Architect",
    section: "merge",
    sectionLabel: "Tổng hợp & đồng bộ",
    icon: Sparkles,
    iconColor: "text-indigo-400",
    border: "border-indigo-500/30",
    gradient: "from-indigo-500/15 to-purple-900/5",
    models: ["openai/gpt-oss-120b:free"],
    description:
      "Tổng hợp và đồng bộ tất cả sections, Zod validation, feedback loop và đảm bảo chất lượng đầu ra.",
    skills: ["Review", "Architecture", "Quality Assurance", "Consistency"],
  },
];

/* ============================================================
   Static Tech Stack Reference
============================================================ */

const TECH_STACKS: TechStackGroup[] = [
  {
    title: "Frontend",
    icon: Code2,
    iconColor: "text-cyan-400",
    border: "border-cyan-500/30",
    gradient: "from-cyan-500/15 to-blue-900/5",
    items: [
      { name: "React", note: "Thư viện UI phổ biến nhất" },
      { name: "Next.js", note: "Full-stack framework React" },
      { name: "Vue", note: "Progressive framework" },
      { name: "Angular", note: "Enterprise framework" },
    ],
  },
  {
    title: "Backend",
    icon: Server,
    iconColor: "text-emerald-400",
    border: "border-emerald-500/30",
    gradient: "from-emerald-500/15 to-teal-900/5",
    items: [
      { name: "Node.js", note: "JS runtime non-blocking" },
      { name: "Python", note: "Django / FastAPI / Flask" },
      { name: "Java", note: "Spring Boot enterprise" },
      { name: "PHP", note: "Laravel web framework" },
    ],
  },
  {
    title: "Database",
    icon: Database,
    iconColor: "text-purple-400",
    border: "border-purple-500/30",
    gradient: "from-purple-500/15 to-indigo-900/5",
    items: [
      { name: "PostgreSQL", note: "RDBMS mạnh mẽ, ACID" },
      { name: "MySQL", note: "RDBMS phổ biến" },
      { name: "MongoDB", note: "NoSQL document store" },
      { name: "SQLite", note: "Database nhúng, nhẹ" },
    ],
  },
  {
    title: "Cache",
    icon: HardDrive,
    iconColor: "text-amber-400",
    border: "border-amber-400/30",
    gradient: "from-amber-400/15 to-orange-900/5",
    items: [
      { name: "Redis", note: "In-memory key-value store" },
      { name: "Memcached", note: "Distributed memory cache" },
    ],
  },
  {
    title: "DevOps",
    icon: GitBranch,
    iconColor: "text-rose-400",
    border: "border-rose-500/30",
    gradient: "from-rose-500/15 to-pink-900/5",
    items: [
      { name: "Docker", note: "Container hóa ứng dụng" },
      { name: "Kubernetes", note: "Orchestration container" },
      { name: "GitHub Actions", note: "CI/CD pipeline" },
    ],
  },
  {
    title: "Architecture",
    icon: Boxes,
    iconColor: "text-blue-400",
    border: "border-blue-500/30",
    gradient: "from-blue-500/15 to-cyan-900/5",
    items: [
      { name: "Monolithic", note: "Kiến trúc đơn" },
      { name: "Microservices", note: "Tách service theo domain" },
      { name: "Serverless", note: "Function-as-a-Service" },
      { name: "Event-Driven", note: "Hệ thống sự kiện" },
    ],
  },
];

/* ============================================================
   Component
============================================================ */

export function KnowledgeBaseView() {
  const setView = useNexus((s) => s.setView);
  const setRoute = useNexus((s) => s.setRoute);
  const setInput = useNexus((s) => s.setInput);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [section, setSection] = useState<"templates" | "agents" | "tech">("templates");

  /* Fetch templates on mount */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/templates");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (cancelled) return;
        const list: TemplateItem[] = Array.isArray(data.templates) ? data.templates : [];
        // Drop the empty "Custom Template" entry to keep the gallery clean
        setTemplates(list.filter((t) => t.id !== "custom" && t.topic));
        setLoading(false);
      } catch {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
        notify.error("Không tải được danh sách templates. Thử lại sau.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Filter templates by query (name / desc / category) */
  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.techPrefs || "").toLowerCase().includes(q),
    );
  }, [templates, searchQuery]);

  /* Filter agents by query too (so the search bar is global) */
  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return AI_AGENTS;
    return AI_AGENTS.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.sectionLabel.toLowerCase().includes(q) ||
        a.skills.some((s) => s.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  /* Filter tech stacks by query */
  const filteredTechStacks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return TECH_STACKS;
    return TECH_STACKS.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          it.name.toLowerCase().includes(q) || it.note.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [searchQuery]);

  /* Apply a template → fill input form → navigate to input view */
  function applyTemplate(t: TemplateItem) {
    setInput({
      topic: t.topic,
      description: t.description,
      purpose: t.purpose,
      extraInfo: {
        requirements: "",
        specialReqs: "",
        techPrefs: t.techPrefs,
        langPrefs: t.langPrefs,
      },
    });
    setRoute(null, null);
    setView("input");
    window.history.pushState({}, "", "/");
    notify.success(
      `Đã áp dụng template "${t.name}" — điền thông tin còn lại rồi bấm Khởi tạo`,
    );
  }

  function reloadTemplates() {
    setLoading(true);
    setLoadError(false);
    // Re-trigger fetch effect by toggling state; simplest is to just refetch inline
    (async () => {
      try {
        const resp = await fetch("/api/templates", { cache: "no-store" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const list: TemplateItem[] = Array.isArray(data.templates) ? data.templates : [];
        setTemplates(list.filter((t) => t.id !== "custom" && t.topic));
        setLoading(false);
        notify.success(`Đã tải ${list.length} templates`);
      } catch {
        setLoading(false);
        setLoadError(true);
        notify.error("Không tải được danh sách templates.");
      }
    })();
  }

  /* ---------- Section tabs ---------- */
  const TABS: { id: typeof section; label: string; icon: typeof Terminal }[] = [
    { id: "templates", label: "Templates", icon: Sparkles },
    { id: "agents", label: "AI Agents", icon: Brain },
    { id: "tech", label: "Tech Stack", icon: Code2 },
  ];

  return (
    <main className="flex-1 flex flex-col bg-nexus-bg/95 min-h-screen nexus-boot">
      {/* ===== Sticky Header ===== */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-nexus-bg/90 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 pl-12 md:pl-0">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Knowledge Base</h1>
              <p className="text-[11px] text-muted-foreground">
                Templates · AI Agents · Tech Stack Reference
              </p>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm templates, agents, tech stack..."
              className="pl-9 bg-nexus-surface-2/60 border-border/40 focus-visible:border-primary/50 focus-visible:ring-primary/20"
            />
          </div>
        </div>

        {/* Section tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSection(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground border border-transparent"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ===== Body ===== */}
      <div className="flex-1 flex overflow-hidden">
        <AppSidebar active="knowledge-base" />

        <div className="flex-1 overflow-y-auto nexus-scroll">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
            {/* ============ Section: Templates ============ */}
            {section === "templates" && (
              <section>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      Templates dự án
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Chọn template để điền nhanh form tạo dự án mới.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reloadTemplates}
                    disabled={loading}
                    className="gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    Tải lại
                  </Button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Đang tải templates...
                  </div>
                ) : loadError ? (
                  <Card className="bg-card border-border rounded-xl">
                    <CardContent className="py-10 text-center text-muted-foreground">
                      Không tải được templates. Vui lòng thử lại.
                    </CardContent>
                  </Card>
                ) : filteredTemplates.length === 0 ? (
                  <Card className="bg-card border-border rounded-xl">
                    <CardContent className="py-10 text-center text-muted-foreground">
                      Không tìm thấy template phù hợp.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map((t) => {
                      const Icon = TEMPLATE_ICON_MAP[t.icon] || Code2;
                      return (
                        <button
                          key={t.id}
                          onClick={() => applyTemplate(t)}
                          className={`text-left nexus-card-hover rounded-xl border ${t.border} bg-gradient-to-br ${t.color} p-5 group flex flex-col gap-3 nexus-hud backdrop-blur-xl shadow-lg shadow-primary/5 hover:shadow-primary/20 transition-all min-h-[150px]`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="w-10 h-10 rounded-lg bg-card/60 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                              <Icon className={`w-5 h-5 ${t.iconColor}`} />
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[9px] font-bold tracking-wider bg-card/40 border-border/40"
                            >
                              {t.category}
                            </Badge>
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                              {t.name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {t.desc}
                            </p>
                          </div>
                          <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/20">
                            <span className="text-[10px] text-muted-foreground truncate pr-2">
                              {t.techPrefs.split(",").slice(0, 2).join(", ")}
                              {t.techPrefs.split(",").length > 2 ? "..." : ""}
                            </span>
                            <span className="text-[11px] font-medium text-primary flex items-center gap-1 shrink-0">
                              Dùng
                              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ============ Section: AI Agents ============ */}
            {section === "agents" && (
              <section>
                <div className="mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    AI Agents Reference
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    10 Agent cấu thành pipeline của NEXUS AI — vai trò, mô hình và kỹ năng.
                  </p>
                </div>

                {filteredAgents.length === 0 ? (
                  <Card className="bg-card border-border rounded-xl">
                    <CardContent className="py-10 text-center text-muted-foreground">
                      Không tìm thấy agent phù hợp.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAgents.map((a) => {
                      const Icon = a.icon;
                      return (
                        <Card
                          key={a.id}
                          className={`bg-card border ${a.border} rounded-xl overflow-hidden`}
                        >
                          <div className={`bg-gradient-to-br ${a.gradient} px-5 py-4 border-b border-border/30`}>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-card/60 backdrop-blur-sm flex items-center justify-center">
                                <Icon className={`w-5 h-5 ${a.iconColor}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] font-bold bg-card/40 border-border/40"
                                  >
                                    #{a.id}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                    {a.sectionLabel}
                                  </span>
                                </div>
                                <h3 className="font-semibold text-sm mt-0.5 truncate">
                                  {a.name}
                                </h3>
                                <p className="text-[11px] text-muted-foreground">
                                  {a.role}
                                </p>
                              </div>
                            </div>
                          </div>

                          <CardContent className="px-5 py-4 space-y-3">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {a.description}
                            </p>

                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                                Mô hình
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {a.models.map((m) => (
                                  <Badge
                                    key={m}
                                    variant="secondary"
                                    className="text-[10px] font-mono bg-nexus-surface-2/60 border border-border/30 text-primary"
                                  >
                                    {m}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                                Kỹ năng
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {a.skills.map((s) => (
                                  <Badge
                                    key={s}
                                    variant="outline"
                                    className="text-[10px] border-border/40 text-muted-foreground"
                                  >
                                    {s}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ============ Section: Tech Stack ============ */}
            {section === "tech" && (
              <section>
                <div className="mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-primary" />
                    Tech Stack Reference
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Các tech stack phổ biến được sử dụng trong dự án NEXUS AI.
                  </p>
                </div>

                {filteredTechStacks.length === 0 ? (
                  <Card className="bg-card border-border rounded-xl">
                    <CardContent className="py-10 text-center text-muted-foreground">
                      Không tìm thấy tech stack phù hợp.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTechStacks.map((g) => {
                      const Icon = g.icon;
                      return (
                        <Card
                          key={g.title}
                          className={`bg-card border ${g.border} rounded-xl overflow-hidden`}
                        >
                          <div className={`bg-gradient-to-br ${g.gradient} px-5 py-4 border-b border-border/30 flex items-center gap-3`}>
                            <div className="w-9 h-9 rounded-lg bg-card/60 backdrop-blur-sm flex items-center justify-center">
                              <Icon className={`w-4.5 h-4.5 ${g.iconColor}`} />
                            </div>
                            <h3 className="font-semibold text-sm">{g.title}</h3>
                          </div>
                          <CardContent className="px-5 py-4">
                            <ul className="space-y-2">
                              {g.items.map((it) => (
                                <li
                                  key={it.name}
                                  className="flex items-start justify-between gap-2 text-xs"
                                >
                                  <span className="font-medium text-foreground">
                                    {it.name}
                                  </span>
                                  <span className="text-muted-foreground text-right text-[11px]">
                                    {it.note}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
