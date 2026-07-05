"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Cpu, Brain, Sparkles, Rocket, Code2, Database, Shield, GitBranch,
  Users, CheckSquare, Zap, Activity, ArrowRight, Play, ChevronDown,
  Terminal, Bot, Network, Layers, Clock, Star, Github, Mail,
} from "lucide-react";
import dynamic from "next/dynamic";

const Scene3D = dynamic(() => import("./Scene3D").then(m => m.Scene3D), { ssr: false });

const AGENTS = [
  { id: "01", name: "Requirement Analyst", role: "Business Analyst", icon: Terminal, color: "text-cyan-400", desc: "Phân tích yêu cầu, tech stack, features, actors, modules" },
  { id: "02", name: "HR Planner", role: "HR Manager", icon: Users, color: "text-emerald-400", desc: "Phân vai trò, workload, rủi ro cho thành viên" },
  { id: "03", name: "Sprint Planner", role: "Scrum Master", icon: Clock, color: "text-cyan-400", desc: "Chia sprint, gán task, deadline, milestones" },
  { id: "04", name: "System Architect", role: "Software Architect", icon: Database, color: "text-purple-400", desc: "Thiết kế DB schema, API endpoints, folder structure" },
  { id: "05", name: "UML Generator", role: "UML Expert", icon: Network, color: "text-cyan-400", desc: "Sinh 4 diagram: Use Case, Class, ERD, Sequence" },
  { id: "06", name: "Technical Writer", role: "Tech Writer", icon: Code2, color: "text-emerald-400", desc: "Viết README, Coding Convention, API Standard" },
  { id: "07", name: "Git / DevOps", role: "DevOps Engineer", icon: GitBranch, color: "text-amber-400", desc: "Git commands, branch strategy, CI/CD, issue template" },
  { id: "08", name: "Software Tester", role: "QA Engineer", icon: CheckSquare, color: "text-rose-400", desc: "Sinh test plan: unit, integration, E2E, API tests" },
  { id: "09", name: "Security Reviewer", role: "Security Architect", icon: Shield, color: "text-red-400", desc: "Phân tích threats, OWASP Top 10, auth flow, rate limit" },
  { id: "10", name: "Quality Reviewer", role: "Senior Architect", icon: Sparkles, color: "text-primary", desc: "Tổng hợp + đồng bộ tất cả sections, Zod validation" },
];


const FEATURES = [
  { icon: Brain, title: "10 AI Agents", desc: "Multi-Agent pipeline tự động phân tích, thiết kế, lập kế hoạch cho toàn bộ dự án", color: "from-cyan-500/20 to-blue-600/5" },
  { icon: Rocket, title: "Auto Pipeline", desc: "6-phase pipeline: Analysis → HR → Sprint → Design → UML → Docs → Git → Test → Security → Review", color: "from-emerald-500/20 to-teal-600/5" },
  { icon: Activity, title: "Live Log Console", desc: "Theo dõi real-time từng model, API key, agent status trong quá trình pipeline chạy", color: "from-purple-500/20 to-indigo-600/5" },
  { icon: GitBranch, title: "GitHub Integration", desc: "OAuth + auto push code lên repository. Branch strategy + CI/CD tự động", color: "from-amber-500/20 to-orange-600/5" },
  { icon: Mail, title: "Mail System", desc: "Soạn + gửi email thật qua SMTP. AI viết lại nội dung. Mailbox đầy đủ: Inbox, Sent, Draft, Starred", color: "from-rose-500/20 to-pink-600/5" },
  { icon: Activity, title: "Notification Center", desc: "Realtime notifications qua WebSocket. 13 loại thông báo, per-user read tracking", color: "from-cyan-500/20 to-teal-600/5" },
];

const PRICING = [
  { name: "Starter", price: "Free", desc: "Cho cá nhân & dự án nhỏ", features: ["10 AI Agents", "5 dự án", "Live Log Console", "GitHub Integration", "Community Support"], highlight: false },
  { name: "Pro", price: "$29", desc: "Cho team phát triển", features: ["Everything in Starter", "Unlimited dự án", "Mail System + SMTP", "Notification Center", "AI Mermaid Fixer", "Priority Support"], highlight: true },
  { name: "Enterprise", price: "Custom", desc: "Cho doanh nghiệp", features: ["Everything in Pro", "Custom AI Agents", "On-premise deploy", "SSO + SAML", "Dedicated support", "SLA 99.9%"], highlight: false },
];

const TECH_STACK = [
  "Next.js 16", "TypeScript 5", "Tailwind CSS 4", "shadcn/ui", "Prisma ORM",
  "Socket.io", "Three.js", "React Three Fiber", "Framer Motion", "Zustand",
  "OpenRouter AI", "Mermaid.js", "nodemailer", "SQLite",
];

export function LandingPage({ onLaunch }: { onLaunch: () => void }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#060b14] text-foreground overflow-x-hidden nexus-scanlines nexus-vignette">
      {/* Moving scan line */}
      <div className="nexus-scan-line" />

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* 3D Scene background */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${mousePos.x * -15}px, ${mousePos.y * -15}px)`,
          }}
        >
          <Scene3D />
        </div>

        {/* Grid overlay */}
        <div className="absolute inset-0 nexus-futuristic-grid opacity-20" />

        {/* Aurora overlay */}
        <div className="absolute inset-0 nexus-aurora opacity-30" />

        {/* Content */}
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 text-center px-6 max-w-5xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-md mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-muted-foreground tracking-wider">AI OPERATING SYSTEM · v2.5 · ONLINE</span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight nexus-glow-text"
            style={{
              transform: `perspective(1000px) rotateX(${mousePos.y * 3}deg) rotateY(${mousePos.x * 3}deg)`,
            }}
          >
            <span className="nexus-holo-text nexus-chromatic">NEXUS AI</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-lg sm:text-xl text-muted-foreground mt-6 tracking-wide"
          >
            The Future of Multi-Agent Intelligence
          </motion.p>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="text-sm text-muted-foreground/70 max-w-2xl mx-auto mt-4"
          >
            10 AI Agents tự động phân tích, thiết kế, lập sprint, sinh todolist, push GitHub và gửi email — tất cả trong một nền tảng.
          </motion.p>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="flex flex-wrap items-center justify-center gap-4 mt-10"
          >
            <button
              onClick={onLaunch}
              className="group relative px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm overflow-hidden transition-all hover:scale-105 nexus-neon-glow"
            >
              <span className="relative z-10 flex items-center gap-2">
                <Rocket className="w-4 h-4" /> Launch Workspace
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button className="group relative px-8 py-3.5 rounded-xl border border-border/50 backdrop-blur-md text-sm font-medium hover:border-primary/30 transition-all flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" /> Watch Demo
            </button>

            <button className="group relative px-8 py-3.5 rounded-xl border border-border/50 backdrop-blur-md text-sm font-medium hover:border-primary/30 transition-all flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" /> Explore AI
            </button>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground/40"
          >
            <span className="text-[9px] uppercase tracking-widest">Scroll to explore</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </motion.div>
        </motion.div>

        {/* Floating HUD elements */}
        <div className="absolute top-8 left-8 hidden lg:block">
          <div className="nexus-holo-panel nexus-hud-corners rounded-xl p-3 text-[10px] font-mono text-primary/70">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>SYSTEM ONLINE</span>
            </div>
            <div className="text-muted-foreground/50">CPU: 12% · MEM: 4.2GB · NET: 1ms</div>
          </div>
        </div>
        <div className="absolute top-8 right-8 hidden lg:block">
          <div className="nexus-holo-panel nexus-hud-corners rounded-xl p-3 text-[10px] font-mono text-cyan-400/70">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>10 AGENTS READY</span>
            </div>
            <div className="text-muted-foreground/50">Pipeline: READY · Queue: 0</div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section className="relative py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionTitle label="FEATURES" title="Everything You Need to Build" desc="Từ phân tích đến deploy — toàn bộ quy trình phát triển dự án tự động hóa bởi AI" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {FEATURES.map((f, i) => (
              <FeatureCard key={i} {...f} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== AI AGENTS SECTION ===== */}
      <section className="relative py-24 px-6 overflow-hidden">
        {/* Background effect */}
        <div className="absolute inset-0 nexus-futuristic-grid opacity-10" />
        <div className="absolute inset-0 nexus-aurora opacity-20" />

        <div className="max-w-7xl mx-auto relative z-10">
          <SectionTitle label="AI AGENTS" title="10 Specialized AI Agents" desc="Mỗi Agent có role, model, và kỹ năng riêng — phối hợp như một đội ngũ thực thụ" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-12">
            {AGENTS.map((agent, i) => (
              <AgentCard key={agent.id} {...agent} delay={i * 0.05} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== DASHBOARD PREVIEW SECTION ===== */}
      <section className="relative py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionTitle label="LIVE DASHBOARD" title="Real-Time AI Command Center" desc="Theo dõi toàn bộ hệ thống — agents, pipeline, tasks, notifications — trong một giao diện" />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
            <LiveStat label="AI Agents Online" value="10/10" icon={Bot} color="text-emerald-400" />
            <LiveStat label="Active Projects" value="18" icon={Rocket} color="text-primary" />
            <LiveStat label="Tasks Generated" value="247" icon={CheckSquare} color="text-cyan-400" />
            <LiveStat label="Pipeline Status" value="Ready" icon={Activity} color="text-amber-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            <ActivityFeed />
            <AgentActivity />
            <SystemStatus />
          </div>
        </div>
      </section>

      {/* ===== WORKFLOW SECTION ===== */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 nexus-futuristic-grid opacity-10" />
        <div className="max-w-5xl mx-auto relative z-10">
          <SectionTitle label="WORKFLOW" title="6-Phase AI Pipeline" desc="Từ ý tưởng đến code — tự động hoàn toàn" />

          <div className="space-y-3 mt-12">
            {[
              { phase: "Phase 1", title: "Analysis + HR + Sprint", desc: "Phân tích chủ đề, phân nhân sự, lập sprint", icon: Terminal, color: "text-cyan-400" },
              { phase: "Phase 2", title: "Design + UML + Docs + Git", desc: "Thiết kế hệ thống, vẽ UML, viết tài liệu, git workflow", icon: Database, color: "text-emerald-400" },
              { phase: "Phase 3", title: "Test + Security", desc: "Sinh test plan, review security, OWASP", icon: Shield, color: "text-amber-400" },
              { phase: "Phase 4", title: "Retry Failed Agents", desc: "Thử lại agents thất bại với 60s delay", icon: Zap, color: "text-rose-400" },
              { phase: "Phase 5", title: "Fallback + Task Generation", desc: "Sinh dữ liệu dự phòng + todolist chi tiết", icon: Layers, color: "text-purple-400" },
              { phase: "Phase 6", title: "Quality Review", desc: "Tổng hợp + đồng bộ + Zod validation", icon: Sparkles, color: "text-primary" },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="nexus-holo-panel nexus-hud-corners nexus-glow-border rounded-xl p-4 flex items-center gap-4"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-card/40 flex items-center justify-center">
                  <step.icon className={`w-5 h-5 ${step.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{step.phase}</span>
                    <span className="text-xs font-bold">{step.title}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/30" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TECH STACK SECTION ===== */}
      <section className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <SectionTitle label="TECHNOLOGY" title="Powered by Cutting-Edge Stack" desc="Xây dựng trên những công nghệ tiên tiến nhất" />
          <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
            {TECH_STACK.map((tech, i) => (
              <motion.span
                key={tech}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="px-4 py-2 rounded-lg nexus-holo-panel nexus-glow-border text-sm text-muted-foreground hover:text-primary transition-colors cursor-default"
              >
                {tech}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING SECTION ===== */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 nexus-aurora opacity-20" />
        <div className="max-w-6xl mx-auto relative z-10">
          <SectionTitle label="PRICING" title="Choose Your Plan" desc="Từ miễn phí đến doanh nghiệp — có gói phù hợp cho mọi team" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {PRICING.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`nexus-holo-panel nexus-hud-corners rounded-2xl p-6 ${
                  plan.highlight ? "border-primary/40 nexus-neon-glow" : "nexus-glow-border"
                }`}
              >
                {plan.highlight && (
                  <div className="inline-block px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold uppercase tracking-wider mb-3">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="text-xs text-muted-foreground mb-4">{plan.desc}</p>
                <div className="text-3xl font-bold mb-4">
                  {plan.price}<span className="text-sm text-muted-foreground font-normal">{plan.price !== "Custom" ? "/mo" : ""}</span>
                </div>
                <div className="space-y-2">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckSquare className="w-3 h-3 text-primary flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
                <button
                  onClick={onLaunch}
                  className={`w-full mt-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    plan.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 nexus-neon-glow"
                      : "border border-border/50 hover:border-primary/30"
                  }`}
                >
                  Get Started
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="relative py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="nexus-holo-panel nexus-hud-corners rounded-3xl p-12 nexus-neon-glow"
          >
            <Cpu className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold nexus-glow-text">Ready to Build the Future?</h2>
            <p className="text-sm text-muted-foreground mt-3 mb-8">
              Khởi tạo dự án đầu tiên — 10 AI Agent sẽ phân tích, thiết kế và lập kế hoạch cho bạn.
            </p>
            <button
              onClick={onLaunch}
              className="px-10 py-4 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:scale-105 transition-transform nexus-neon-glow inline-flex items-center gap-2"
            >
              <Rocket className="w-5 h-5" /> Launch NEXUS AI
            </button>
          </motion.div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="relative py-12 px-6 border-t border-border/30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">NEXUS AI</span>
            <span className="text-[10px] text-muted-foreground ml-2">Multi-Agent Architect · v2.5</span>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors"><Github className="w-4 h-4" /></a>
            <span className="text-[10px]">© 2026 NEXUS AI · All rights reserved</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ===== Sub-components ===== */
function SectionTitle({ label, title, desc }: { label: string; title: string; desc: string }) {
  return (
    <div className="text-center">
      <motion.span
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="inline-block text-[10px] font-mono text-primary/60 uppercase tracking-[0.3em] mb-3"
      >
        {label}
      </motion.span>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-3xl sm:text-4xl font-bold nexus-glow-text"
      >
        {title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto"
      >
        {desc}
      </motion.p>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, color, delay }: { icon: typeof Brain; title: string; desc: string; color: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -5 }}
      className="nexus-holo-panel nexus-hud-corners nexus-glow-border rounded-2xl p-6 group"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-bold text-sm mb-2">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </motion.div>
  );
}

function AgentCard({ id, name, role, icon: Icon, color, desc, delay }: { id: string; name: string; role: string; icon: typeof Brain; color: string; desc: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -5, scale: 1.03 }}
      className="nexus-holo-panel nexus-hud-corners nexus-glow-border rounded-xl p-4 text-center"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-mono text-muted-foreground/50">{id}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>
      <div className="w-10 h-10 rounded-xl bg-card/40 flex items-center justify-center mx-auto mb-3">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <h4 className="text-xs font-bold truncate">{name}</h4>
      <p className="text-[9px] text-muted-foreground mt-0.5">{role}</p>
      <p className="text-[10px] text-muted-foreground/60 mt-2 line-clamp-2">{desc}</p>
    </motion.div>
  );
}

function LiveStat({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof Brain; color: string }) {
  return (
    <div className="nexus-holo-panel nexus-hud-corners rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
    </div>
  );
}

function ActivityFeed() {
  const [activities, setActivities] = useState<string[]>([]);
  useEffect(() => {
    const messages = [
      "Agent 01 → Analysis complete",
      "Agent 04 → Schema designed",
      "Agent 07 → Git workflow ready",
      "Agent 08 → Test plan generated",
      "Pipeline → 10/10 agents done",
      "Task gen → 18 tasks created",
      "Email → 3 invitations sent",
    ];
    const interval = setInterval(() => {
      setActivities((prev) => {
        const next = [...prev, messages[Math.floor(Math.random() * messages.length)]];
        return next.slice(-6);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="nexus-holo-panel nexus-hud-corners rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Live Activity</span>
      </div>
      <div className="space-y-1.5 h-48 overflow-y-auto nexus-landing-scroll">
        <AnimatePresence>
          {activities.map((a, i) => (
            <motion.div
              key={i + a}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-[10px] font-mono text-primary/70 flex items-center gap-2"
            >
              <span className="text-emerald-400">▸</span> {a}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AgentActivity() {
  return (
    <div className="nexus-holo-panel nexus-hud-corners rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Agent Board</span>
      </div>
      <div className="space-y-1.5 h-48 overflow-y-auto nexus-landing-scroll">
        {AGENTS.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-[10px]">
            <span className="font-mono text-muted-foreground/50 w-5">{a.id}</span>
            <span className="flex-1 truncate">{a.name}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemStatus() {
  return (
    <div className="nexus-holo-panel nexus-hud-corners rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Cpu className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">System Status</span>
      </div>
      <div className="space-y-2.5 h-48">
        {[
          { label: "Database", value: "Connected", color: "text-emerald-400", pct: 100 },
          { label: "Pipeline", value: "Ready", color: "text-primary", pct: 100 },
          { label: "API Keys", value: "3 Active", color: "text-cyan-400", pct: 60 },
          { label: "Storage", value: "12.4 MB", color: "text-emerald-400", pct: 85 },
          { label: "Redis", value: "Not configured", color: "text-muted-foreground", pct: 0 },
        ].map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">{s.label}</span>
              <span className={s.color}>{s.value}</span>
            </div>
            <div className="h-1 bg-border/30 rounded-full overflow-hidden">
              <div className={`h-full ${s.color.replace("text-", "bg-")}`} style={{ width: `${s.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
