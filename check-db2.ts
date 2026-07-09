import { db } from "@/lib/db";

async function main() {
  const projects = await db.project.findMany({
    select: { id: true, topic: true, status: true, createdAt: true, _count: { select: { analyses: true } } },
    orderBy: { createdAt: "desc" },
  });
  console.log("=== ALL PROJECTS (" + projects.length + ") ===");
  for (const p of projects) {
    console.log(`[${p.status}] ${p.topic} | analyses=${p._count.analyses} | ${p.createdAt.toISOString()}`);
  }
  
  // Find the "bán hàng" project
  const banhang = projects.find(p => p.topic.toLowerCase().includes("bán hàng") || p.topic.toLowerCase().includes("ban hang"));
  if (banhang) {
    console.log("\n=== FOUND bán hàng project ===");
    console.log("id:", banhang.id);
    const analyses = await db.analysis.findMany({ where: { projectId: banhang.id }, select: { type: true, content: true, version: true } });
    console.log("analyses count:", analyses.length);
    for (const a of analyses) {
      console.log(`\n--- type=${a.type} v${a.version} len=${a.content.length} ---`);
      console.log(a.content.substring(0, 500));
    }
    
    // Also check ProjectContext
    const ctx = await db.projectContext.findUnique({ where: { projectId: banhang.id } });
    console.log("\nProjectContext:", ctx ? `exists, runCount=${ctx.runCount}, summary len=${ctx.summary?.length||0}` : "NULL");
    
    // Check PipelineStatus
    const pipes = await db.pipelineStatus.findMany({ where: { projectId: banhang.id }, orderBy: { createdAt: "desc" }, take: 3 });
    console.log("\nPipelineStatus (last 3):");
    for (const ps of pipes) {
      console.log(`  [${ps.status}] ${ps.currentAgent} ${ps.progress}% stage=${ps.stage} err=${ps.error || "none"} at=${ps.updatedAt.toISOString()}`);
    }
  } else {
    console.log("\n!! bán hàng project NOT FOUND");
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
