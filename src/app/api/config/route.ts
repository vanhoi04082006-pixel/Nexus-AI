// NEXUS AI - GET /api/config
// Returns the current public URL so the frontend can display it
// and users can copy-share it with team members.

import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  let publicUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";

  // Try reading from .public-url file (updated by tunnel script)
  if (!publicUrl || publicUrl.includes("localhost")) {
    try {
      const urlPath = path.join(process.cwd(), ".public-url");
      const fileContent = fs.readFileSync(urlPath, "utf-8").trim();
      if (fileContent && fileContent.startsWith("http")) {
        publicUrl = fileContent;
      }
    } catch {
      /* file not found */
    }
  }

  if (!publicUrl) publicUrl = "http://localhost:3000";

  return Response.json({
    publicUrl,
    isLocal: publicUrl.includes("localhost") || publicUrl.includes("127.0.0.1"),
  });
}
