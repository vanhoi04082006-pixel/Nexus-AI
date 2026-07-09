import { db } from "@/lib/db";

async function main() {
  const projects = await db.project.findMany({
    select: {
      id: true,
      topic: true,
      status: true,
      createdAt: true,
      _count: { select: { analyses: true, members: true, tasks: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log("=== PROJECTS ===");
  for (const p of projects) {
    console.log(`\n[${p.status}] ${p.topic}`);
    console.log(`  id=${p.id}`);
    console.log(`  createdAt=${p.createdAt.toISOString()}`);
    console.log(`  analyses=${p._count.analyses}  members=${p._count.members}  tasks=${p._count.tasks}`);
  }

  if (projects.length > 0) {
    const latestId = projects[0].id;
    const analyses = await db.analysis.findMany({
      where: { projectId: latestId },
      select: { type: true, content: true, version: true, updatedAt: true },
    });
    console.log(`\n=== ANALYSES for latest project (${latestId}) ===`);
    for (const a of analyses) {
      const preview = a.content.substring(0, 300);
      console.log(`\n--- type=${a.type}  v${a.version}  updatedAt=${a.updatedAt.toISOString()} ---`);
      console.log(`length=${a.content.length}`);
      console.log(`preview: ${preview}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
