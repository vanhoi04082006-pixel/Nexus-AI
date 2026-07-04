// NEXUS AI - GET /api/templates
// Returns all project templates (built-in static list)

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TEMPLATES = [
  { id: "fullstack", name: "Fullstack Web App", desc: "Next.js + Prisma + shadcn/ui", category: "WEB", icon: "Code2", color: "from-cyan-500/20 to-blue-600/5", iconColor: "text-cyan-400", border: "border-cyan-500/30",
    topic: "Hệ thống Fullstack Web App", description: "Ứng dụng web full-stack với Next.js, Prisma, shadcn/ui, JWT auth, dashboard", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, TypeScript, Tailwind CSS, Prisma, PostgreSQL, shadcn/ui, JWT, Docker", langPrefs: "TypeScript, SQL" },
  { id: "ecommerce", name: "E-commerce System", desc: "Shop + Payment + Inventory", category: "ECOMMERCE", icon: "ShoppingBag", color: "from-emerald-500/20 to-teal-600/5", iconColor: "text-emerald-400", border: "border-emerald-500/30",
    topic: "Hệ thống Thương mại Điện tử", description: "Sàn TMĐT với quản lý sản phẩm, giỏ hàng, thanh toán, đơn hàng, đánh giá, kho hàng", purpose: "Sản phẩm thực tế",
    techPrefs: "Next.js, React, Stripe, Prisma, PostgreSQL, Redis, Tailwind CSS", langPrefs: "TypeScript, SQL" },
  { id: "management", name: "Management System", desc: "CRM / ERP / HRM dashboard", category: "MANAGEMENT", icon: "Settings", color: "from-purple-500/20 to-indigo-600/5", iconColor: "text-purple-400", border: "border-purple-500/30",
    topic: "Hệ thống Quản lý Doanh nghiệp", description: "Hệ thống quản lý CRM/ERP/HRM với dashboard, báo cáo, phân quyền", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Tailwind CSS, Chart.js, shadcn/ui", langPrefs: "TypeScript, SQL" },
  { id: "hotel", name: "Hotel Management", desc: "Quản lý khách sạn đa chi nhánh", category: "HOTEL", icon: "Settings", color: "from-amber-400/20 to-orange-600/5", iconColor: "text-amber-400", border: "border-amber-400/30",
    topic: "Hệ thống Quản lý Khách sạn", description: "Quản lý đặt phòng, check-in/check-out, thanh toán, đa chi nhánh", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Redis, Tailwind CSS, shadcn/ui", langPrefs: "TypeScript, SQL" },
  { id: "lms", name: "Learning Management", desc: "LMS / E-learning Platform", category: "LMS", icon: "Code2", color: "from-cyan-500/20 to-teal-600/5", iconColor: "text-cyan-300", border: "border-cyan-500/30",
    topic: "Hệ thống Quản lý Học trực tuyến", description: "LMS với khóa học, video, bài giảng, đăng ký học phần, theo dõi tiến độ, chứng chỉ", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Tailwind CSS, shadcn/ui, AWS S3", langPrefs: "TypeScript, SQL" },
  { id: "mobile", name: "Mobile App", desc: "React Native / Flutter", category: "MOBILE", icon: "Smartphone", color: "from-amber-400/20 to-orange-600/5", iconColor: "text-amber-400", border: "border-amber-400/30",
    topic: "Ứng dụng Mobile", description: "Ứng dụng di động đa nền tảng với authentication, navigation, state management", purpose: "Đồ án tốt nghiệp",
    techPrefs: "React Native, Expo, TypeScript, Tailwind CSS, Redux Toolkit", langPrefs: "TypeScript, JavaScript" },
  { id: "hospital", name: "Hospital Management", desc: "Quản lý bệnh viện / phòng khám", category: "HOSPITAL", icon: "Settings", color: "from-rose-500/20 to-pink-600/5", iconColor: "text-rose-400", border: "border-rose-500/30",
    topic: "Hệ thống Quản lý Bệnh viện", description: "Quản lý bệnh nhân, bác sĩ, lịch hẹn, khám bệnh, toa thuốc, hóa viện", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Tailwind CSS, shadcn/ui", langPrefs: "TypeScript, SQL" },
  { id: "warehouse", name: "Warehouse & Inventory", desc: "Quản lý kho bãi, nhập xuất", category: "WAREHOUSE", icon: "ShoppingBag", color: "from-emerald-500/20 to-green-600/5", iconColor: "text-emerald-300", border: "border-emerald-500/30",
    topic: "Hệ thống Quản lý Kho bãi", description: "Quản lý nhập xuất tồn kho, sản phẩm, nhà cung cấp, đơn hàng, báo cáo tồn", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Redis, Tailwind CSS, shadcn/ui", langPrefs: "TypeScript, SQL" },
  { id: "banking", name: "Banking & Fintech", desc: "Ngân hàng số, ví điện tử", category: "BANKING", icon: "Settings", color: "from-cyan-500/20 to-blue-600/5", iconColor: "text-cyan-300", border: "border-cyan-500/30",
    topic: "Hệ thống Ngân hàng Số", description: "Ngân hàng số với tài khoản, chuyển khoản, thanh toán, quản lý giao dịch, bảo mật OTP", purpose: "Sản phẩm thực tế",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Redis, JWT, OTP, Tailwind CSS", langPrefs: "TypeScript, SQL" },
  { id: "aisaas", name: "AI SaaS Platform", desc: "Nền tảng AI as a Service", category: "AI_SAAS", icon: "Code2", color: "from-purple-500/20 to-indigo-600/5", iconColor: "text-purple-300", border: "border-purple-500/30",
    topic: "Nền tảng AI SaaS", description: "Nền tảng AI as a Service với API gateway, model management, billing, usage tracking", purpose: "Sản phẩm thực tế",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Redis, OpenAI API, Stripe, Tailwind CSS", langPrefs: "TypeScript, Python, SQL" },
  { id: "chat", name: "Chat Application", desc: "Chat / Social Network", category: "CHAT", icon: "Smartphone", color: "from-emerald-500/20 to-teal-600/5", iconColor: "text-emerald-300", border: "border-emerald-500/30",
    topic: "Ứng dụng Chat Realtime", description: "Chat realtime với nhóm, tin nhắn, file sharing, emoji, gọi video, status", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Redis, Socket.io, WebRTC, Tailwind CSS", langPrefs: "TypeScript, SQL" },
  { id: "microservices", name: "Microservices Architecture", desc: "Kiến trúc microservices", category: "MICROSERVICES", icon: "Settings", color: "from-amber-400/20 to-orange-600/5", iconColor: "text-amber-300", border: "border-amber-400/30",
    topic: "Hệ thống Microservices", description: "Kiến trúc microservices với API Gateway, Service Discovery, Circuit Breaker, Config Server", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, Spring Boot, Docker, Kubernetes, RabbitMQ, PostgreSQL, Redis", langPrefs: "TypeScript, Java, SQL" },
  { id: "k8s", name: "Cloud Native / Kubernetes", desc: "Deploy & orchestration", category: "K8S", icon: "Code2", color: "from-cyan-500/20 to-blue-600/5", iconColor: "text-cyan-300", border: "border-cyan-500/30",
    topic: "Nền tảng Cloud Native", description: "Hệ thống deploy trên Kubernetes với CI/CD, auto-scaling, monitoring, logging", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, Docker, Kubernetes, GitHub Actions, Prometheus, Grafana, Nginx", langPrefs: "TypeScript, YAML, Bash" },
  { id: "dashboard", name: "Business Intelligence Dashboard", desc: "BI / Analytics", category: "DASHBOARD", icon: "Settings", color: "from-purple-500/20 to-pink-600/5", iconColor: "text-purple-300", border: "border-purple-500/30",
    topic: "Dashboard Business Intelligence", description: "BI dashboard với biểu đồ, KPI, báo cáo, export PDF/Excel, real-time data", purpose: "Đồ án tốt nghiệp",
    techPrefs: "Next.js, React, Prisma, PostgreSQL, Chart.js, D3.js, Tailwind CSS, shadcn/ui", langPrefs: "TypeScript, SQL" },
  { id: "custom", name: "Custom Template", desc: "Tạo dự án từ đầu", category: "CUSTOM", icon: "Code2", color: "from-slate-500/20 to-slate-600/5", iconColor: "text-slate-300", border: "border-slate-500/30",
    topic: "", description: "", purpose: "",
    techPrefs: "", langPrefs: "" },
];

export async function GET() {
  return Response.json({ templates: TEMPLATES });
}
