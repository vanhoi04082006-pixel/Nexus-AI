// NEXUS AI - POST /api/projects/[id]/fix-mermaid
// AI-powered Mermaid diagram fixer. Takes broken Mermaid code + error message,
// sends to OpenRouter AI to fix syntax, returns the fixed code.
// Used by MermaidRenderer when regex-based fixes fail.

import { db } from "@/lib/db";
import { resolveAccess } from "@/lib/access";
import { callOpenRouter } from "@/lib/openrouter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const FIX_MODELS = [
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3-coder:free",
];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    const access = await resolveAccess(id, token);
    if (!access) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const body = (await req.json()) as {
      code: string;
      error: string;
      diagramType: string; // "useCase" | "classDiagram" | "erd" | "sequence"
    };

    if (!body.code || !body.error) {
      return Response.json({ error: "code and error required" }, { status: 400 });
    }

    const project = await db.project.findUnique({
      where: { id },
      select: { topic: true },
    });

    const systemPrompt = `Bạn là chuyên gia Mermaid.js. Nhiệm vụ: sửa mã Mermaid bị lỗi syntax để render thành công.

Quy tắc BẮT BUỘC:
1. Node ID phải chỉ chứa [A-Za-z0-9_] — KHÔNG dấu tiếng Việt, KHÔNG khoảng trắng.
   Ví dụ: "Bệnh nhân" → "BenhNhan", "Dược sĩ" → "DuocSi", "Đăng ký" → "DangKy"
2. Node labels trong ["..."] hoặc ("...") có thể chứa tiếng Việt.
3. KHÔNG dùng cú pháp |label| cho classDiagram — dùng "A --> B : label" thay thế.
4. Giữ nguyên cấu trúc diagram, chỉ sửa syntax.
5. Trả về CHỈ mã Mermaid đã sửa, không markdown fences, không giải thích.
6. Dòng đầu tiên phải là declaration: "graph TD", "classDiagram", "erDiagram", hoặc "sequenceDiagram".
7. Cho graph TD: "graph TD" phải có khoảng trắng giữa "graph" và "TD".
8. Cho include/extend: dùng "A -->|include| B" hoặc "A -.->|extend| B".

Lỗi hiện tại: ${body.error}
Loại diagram: ${body.diagramType}
Dự án: ${project?.topic || "N/A"}`;

    const userPrompt = `Sửa mã Mermaid sau:\n\n${body.code}`;

    let fixedCode = "";
    let lastError = "";
    for (const model of FIX_MODELS) {
      try {
        const result = await callOpenRouter(
          {
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.1,
            max_tokens: 4000,
          },
          45000
        );
        if (result && result.trim().length > 10) {
          fixedCode = result.trim();
          // Strip markdown code fences if present
          fixedCode = fixedCode
            .replace(/^```(?:mermaid)?\s*\n?/i, "")
            .replace(/\n?```\s*$/i, "")
            .trim();
          if (fixedCode) break;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "unknown";
      }
    }

    if (!fixedCode) {
      return Response.json(
        { error: "AI không thể sửa lúc này", details: lastError },
        { status: 502 }
      );
    }

    return Response.json({
      fixedCode,
      model: FIX_MODELS[0],
    });
  } catch (err) {
    return Response.json(
      { error: "Failed to fix Mermaid", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
