// NEXUS AI - POST /api/projects/[id]/mailbox/ai-rewrite
// Uses the AI (OpenRouter) to rewrite/improve an email draft's content.
// The AI predicts the appropriate tone and style based on the project context,
// the recipient, and the subject — so the rewrite is tailored, not generic.
//
// Body: {
//   subject: string,
//   body: string,           // current draft (HTML or plain text)
//   toEmails: string[],
//   mode?: "improve" | "professional" | "friendly" | "concise" | "expand",
//   projectTopic?: string,  // optional context
// }
// Returns: { rewritten: string, original: string, mode: string }

import { resolveAccess, requireLeader } from "@/lib/access";
import { callOpenRouter } from "@/lib/openrouter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RewriteBody {
  subject: string;
  body: string;
  toEmails: string[];
  mode?: "improve" | "professional" | "friendly" | "concise" | "expand";
  projectTopic?: string;
}

const MODE_INSTRUCTIONS: Record<string, string> = {
  improve: "Cải thiện văn phong, sửa lỗi ngữ pháp, làm câu văn mượt mà và chuyên nghiệp hơn nhưng giữ nguyên ý nghĩa và cấu trúc.",
  professional: "Viết lại theo phong cách trang trọng, chuyên nghiệp, phù hợp môi trường công việc. Dùng từ ngữ lịch sự, rõ ràng.",
  friendly: "Viết lại theo phong cách thân thiện, gần gũi, ấm áp nhưng vẫn giữ sự tôn trọng.",
  concise: "Viết lại ngắn gọn, súc tích, đi thẳng vào vấn đề. Loại bỏ các câu thừa.",
  expand: "Mở rộng nội dung, thêm chi tiết, giải thích rõ hơn, làm email đầy đặn hơn nhưng không lan man.",
};

const MODELS = [
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "google/gemma-4-31b-it:free",
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
    if (!access) return Response.json({ error: "Access denied" }, { status: 403 });
    if (!requireLeader(access)) {
      return Response.json({ error: "Chỉ leader được dùng AI rewrite" }, { status: 403 });
    }

    const body = (await req.json()) as RewriteBody;
    if (!body.body || body.body.trim().length === 0) {
      return Response.json({ error: "Nội dung mail trống" }, { status: 400 });
    }

    const mode = body.mode || "improve";
    const modeInstruction = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.improve;
    const recipients = (body.toEmails || []).join(", ") || "đội ngũ dự án";
    const projectTopic = body.projectTopic || "dự án";

    const systemPrompt = `Bạn là trợ lý AI chuyên cải thiện nội dung email công việc.
Nhiệm vụ: viết lại nội dung email cho thành viên trong dự án "${projectTopic}".
Người nhận: ${recipients}.
Chủ đề email: ${body.subject}.

Yêu cầu viết lại: ${modeInstruction}

Quy tắc:
1. Giữ ngôn ngữ Tiếng Việt.
2. Giữ nguyên các thông tin quan trọng, deadline, link, tên người.
3. Trả về HTML hợp lệ (vì sẽ hiển thị trong rich text editor). Dùng <p>, <strong>, <ul>, <li> nếu cần.
4. Không thêm nhận xét hay giải thích — chỉ trả về nội dung email đã viết lại.
5. Nếu email gốc có chữ ký, giữ lại chữ ký đó.`;

    const userPrompt = `Viết lại email sau:\n\n--- EMAIL GỐC ---\n${body.body}\n--- HẾT ---\n\nTrả về HTML đã viết lại:`;

    let rewritten = "";
    let lastError = "";
    for (const model of MODELS) {
      try {
        const result = await callOpenRouter(
          {
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.4,
            max_tokens: 2000,
          },
          60000
        );
        if (result && result.trim().length > 10) {
          rewritten = result.trim();
          break;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "unknown";
        // try next model
      }
    }

    if (!rewritten) {
      return Response.json(
        { error: "AI không thể viết lại lúc này", details: lastError },
        { status: 502 }
      );
    }

    // Strip markdown code fences if the model wrapped the HTML in ```html ... ```
    rewritten = rewritten
      .replace(/^```(?:html)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();

    return Response.json({
      rewritten,
      original: body.body,
      mode,
      model: MODELS[0],
    });
  } catch (err) {
    return Response.json(
      { error: "AI rewrite failed", details: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
